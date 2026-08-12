import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

// Meeting recording -> AI pipeline. Two actions, one function (they always
// run back to back from the same modal, no reason to split the file):
//
//   action=transcribe : multipart audio -> Storage + Groq Whisper -> transcript
//   action=summarize  : transcript text -> Groq (free tier) -> minutes + action points
//
// Groq's free tier caps llama-3.3-70b-versatile at 12,000 tokens/minute -
// a single long meeting transcript can need 2-3x that just as input, before
// any output budget. To stay on the free tier, long transcripts are chunked
// and summarized piece by piece (each chunk request comfortably under the
// limit), then a final pass turns the combined chunk notes - much shorter
// than the raw transcript - into the structured minutes. Short transcripts
// skip chunking and go through the single-call path unchanged.
//
// Both actions check the caller can actually see the target meeting (via a
// JWT-scoped client hitting the real `meetings` RLS) before doing anything
// privileged with the service-role client, same pattern as
// apple-calendar-sync.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

type MeetingPersonInput = { id: string; name: string };

type PointNote = { point: string; notes: string; decisions: string };

type ActionPointProposal = {
  title: string;
  assignee_person_id: string;
  assignee_name: string;
  due: string;
};

const extractMinutesTool = (people: MeetingPersonInput[], agenda: string) => {
  const personIdSchema =
    people.length > 0
      ? { type: "string", enum: [...people.map((person) => person.id), ""] }
      : { type: "string", enum: [""] };

  return {
    type: "function",
    function: {
      name: "extract_minutes",
      description:
        "Turn a raw meeting transcript into formatted minutes plus a list of action points with a best-guess assignee and due date.",
      parameters: {
        type: "object",
        properties: {
          minutes: {
            type: "string",
            description:
              "Minutes of meeting, formatted as numbered sections ('1. DISCUSSION') with numbered points under each ('1.1 ...'), matching what was actually discussed. Section headings must name the actual topic, person, or update the section covers (e.g. '1. WEEKEND / GLS UPDATE', '4. JAMES - YOUTH AND MISSIONS', '8. FACILITY ISSUES') - never a generic bucket like '1. STAFF MEETING', '2. DISCUSSION' or '3. ACTION POINTS' that could sit unchanged on top of any meeting's minutes. If the transcript moves through several speakers giving updates in turn, give each speaker or theme their own section rather than lumping everything under one or two headings. Record the content of what people said, in reported speech - not a description of the topic. Never write that something 'was discussed', 'was raised', 'was reviewed', 'was covered', or that 'the team talked about' or 'various topics included' it: write the actual statements, figures, names, dates, amounts, reasons, objections, questions and answers, in the order they came up, quoting a short phrase verbatim where the wording matters. A point that only restates its own heading back as a sentence ('Staff meeting discussed') is a failure - delete it and write what was actually said instead. Someone who was not in the room must be able to read the point and know what was said, not merely what it was about. Do not invent content that was not said. End with a numbered 'ACTION POINTS' section listing every concrete task raised, each with its owner and due date where stated.",
          },
          point_notes: {
            type: "array",
            description: agenda
              ? "One entry per agenda point that was actually discussed, keyed to the exact point numbers in the agenda outline. Only include points the transcript covers."
              : "Leave this empty when no agenda outline was provided.",
            items: {
              type: "object",
              properties: {
                point: {
                  type: "string",
                  description: "The agenda point number exactly as it appears in the outline, e.g. '2.1' or '2.1.3'.",
                },
                notes: {
                  type: "string",
                  description:
                    "The content of what was said under this point, in reported speech, attributed to whoever said it: 'Sipho said the hall quote came back at R4,500 for the Saturday, up from R3,800 last year, and asked whether the youth budget could carry the difference. Thandi answered that it could not without cutting the camp deposit.' Follow the discussion through - claim, question, answer, objection, agreement - keeping every figure, date, name, amount and reason spoken. Quote a short phrase verbatim where the exact wording matters. Never write meta-descriptions of the discussion ('the venue hire was discussed', 'the team reviewed the budget') - those say nothing. Several sentences, and more where the transcript supports it. Plain prose, no numbering.",
                },
                decisions: {
                  type: "string",
                  description:
                    "What was decided or agreed under this point, in the terms it was agreed: the actual resolution, who is doing it, by when, and any condition attached ('Approved at R4,500, with Thandi to confirm the date with the hall by Friday; if the hall cannot hold the Saturday, the meeting reverts to the church hall'). Empty string if nothing was decided.",
                },
              },
              required: ["point", "notes", "decisions"],
            },
          },
          action_points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "The action item, phrased as a task." },
                assignee_person_id: {
                  ...personIdSchema,
                  description:
                    "The id of the meeting person this was assigned to, from the provided people list. Empty string if unclear or not in the list.",
                },
                assignee_name: {
                  type: "string",
                  description: "The name as said in the transcript, even if it doesn't match assignee_person_id.",
                },
                due: {
                  type: "string",
                  description: "Due date as an ISO date (YYYY-MM-DD) if one was mentioned or clearly implied, otherwise empty string.",
                },
              },
              required: ["title", "assignee_person_id", "assignee_name", "due"],
            },
          },
        },
        required: ["minutes", "point_notes", "action_points"],
      },
    },
  };
};

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ponytail: fixed budgets, not a token-accurate estimate. Each chunk request
// and the final merge request are sized to stay comfortably under Groq free
// tier's 12,000 TPM cap for this model. A meeting long enough to produce
// more than ~5 chunks can still push the merge call over budget - if that
// starts happening, summarize the chunk notes in batches instead of all at
// once.
const CHUNK_CHAR_LIMIT = 12000; // ~3,000 input tokens per chunk request
const CHUNK_MAX_TOKENS = 900;
const FINAL_MAX_TOKENS = 4000;

/** Split on word boundaries into pieces no longer than maxChars, in order. */
const chunkTranscript = (text: string, maxChars: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const word of words) {
    const added = word.length + 1;
    if (currentLen + added > maxChars && current.length) {
      chunks.push(current.join(" "));
      current = [];
      currentLen = 0;
    }
    current.push(word);
    currentLen += added;
  }
  if (current.length) chunks.push(current.join(" "));

  return chunks;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Chunk requests run one after another (see below), but the TPM window is
// shared across all of them - a burst that's fine request-by-request can
// still add up over the free tier's 12,000/minute cap. Groq's 429 tells us
// exactly how long to wait, so honor it and retry rather than fail the
// whole run over a limit that's about to clear.
const callGroq = async (apiKey: string, body: Record<string, unknown>, attempt = 1): Promise<any> => {
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 429 && attempt <= 3) {
    const errorText = await response.text();
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const retryAfterMatch = errorText.match(/try again in ([\d.]+)s/i);
    const retryAfterSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader
      : retryAfterMatch
        ? Number(retryAfterMatch[1])
        : 5;
    await sleep(Math.ceil(retryAfterSeconds * 1000) + 500);
    return callGroq(apiKey, body, attempt + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${errorText}`);
  }

  return response.json();
};

/** Detailed prose notes for one chunk of a transcript - no schema, no
 *  formatting, just what was said. A later pass turns these into the
 *  structured minutes, so nothing here should compress away detail. */
const summarizeChunkWithGroq = async (
  apiKey: string,
  meetingTitle: string,
  chunk: string,
  index: number,
  total: number,
): Promise<string> => {
  const result = await callGroq(apiKey, {
    model: GROQ_MODEL,
    max_tokens: CHUNK_MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          `Meeting: "${meetingTitle}"`,
          `This is part ${index + 1} of ${total} of a raw meeting transcript, in order. Write detailed notes of record covering only this part.`,
          "Write what was actually said - the statements, figures, names, dates, amounts, reasons, questions and answers, in the order they came up, attributed to whoever said them. Never write that something 'was discussed' or 'was covered' - that says nothing. Plain prose, no headings, no numbering. This is a working note a later pass will turn into the final minutes, so don't summarize away detail.",
          `Transcript part:\n${chunk}`,
        ].join("\n\n"),
      },
    ],
  });

  return String(result.choices?.[0]?.message?.content || "").trim();
};

const summarizeTranscript = async (
  transcript: string,
  meetingTitle: string,
  people: MeetingPersonInput[],
  agenda: string,
): Promise<{ minutes: string; pointNotes: PointNote[]; actionPoints: ActionPointProposal[] }> => {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("AI minutes generation is not configured (missing GROQ_API_KEY).");

  const chunks = chunkTranscript(transcript, CHUNK_CHAR_LIMIT);

  // Short transcripts go straight through on the raw text. Long ones get
  // chunk-summarized first, so the final structuring call only ever sees
  // condensed notes instead of the full raw transcript. Chunks run one at a
  // time, not in parallel - the TPM budget is shared across every request
  // in the same minute, and a burst of parallel calls blows it even when
  // each one individually fits.
  let sourceText = transcript;
  if (chunks.length > 1) {
    const chunkNotes: string[] = [];
    for (let index = 0; index < chunks.length; index++) {
      chunkNotes.push(await summarizeChunkWithGroq(apiKey, meetingTitle, chunks[index], index, chunks.length));
    }
    sourceText = chunkNotes.join("\n\n");
  }

  const peopleList = people.length
    ? people.map((person) => `- ${person.name} (id: ${person.id})`).join("\n")
    : "(no meeting people on record)";

  const result = await callGroq(apiKey, {
    model: GROQ_MODEL,
    max_tokens: FINAL_MAX_TOKENS,
    tools: [extractMinutesTool(people, agenda)],
    tool_choice: { type: "function", function: { name: "extract_minutes" } },
    messages: [
      {
        role: "user",
        content: [
          `Meeting: "${meetingTitle}"`,
          `Known meeting people:\n${peopleList}`,
          agenda
            ? `Agenda outline - use these exact point numbers in point_notes, and follow this order in the minutes:\n${agenda}`
            : "",
          `Transcript:\n${sourceText}`,
          [
            "Write minutes of record, not an executive summary, and not a table of contents.",
            "The test every line must pass: does it tell the reader WHAT WAS SAID, or only what the topic was? Topic labels are useless.",
            "",
            'Not acceptable, as a whole set of minutes:',
            '"1. STAFF MEETING\\n1.1 LWC: Staff Meeting discussed\\n1.2 Various church activities and events reviewed\\n2. DISCUSSION\\n2.1 Transcript of meeting discussed\\n2.2 Various topics covered, including church events, staff availability, and technical issues\\n3. ACTION POINTS\\n3.1 Deliver elderly parcels this week"',
            "That example is exactly what to avoid: generic bucket headings, points that just restate the heading, and action points with no owner or reasoning behind them. It reads the same for any meeting that ever happened, which means it recorded nothing.",
            "",
            'Not acceptable, for a single point: "The venue hire for the conference was discussed and a decision was made."',
            'Acceptable: "Sipho reported the hall quote came back at R4,500 for the Saturday, up from R3,800 last year. He asked whether the youth budget could carry the difference. Thandi said it could not without cutting the camp deposit, and suggested asking for the two-day rate instead. Sipho agreed to phone the hall on Thursday."',
            "",
            "Keep every number, date, name, amount, deadline, question, answer, objection and reason that was actually voiced, attributed to the person who said it. Quote a short phrase verbatim where the wording matters. Where the transcript is thin on a point, write the little that was said - never pad it, and never invent.",
            "",
            "When people take turns giving updates (as in a staff meeting going round the table), give each person their own section named after them, and write out what they actually reported: names, dates, decisions, problems raised, follow-ups needed - not that they 'gave an update'.",
          ].join("\n"),
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("The model did not return structured minutes.");

  const parsed = JSON.parse(toolCall.function.arguments);

  return {
    minutes: String(parsed.minutes || ""),
    pointNotes: Array.isArray(parsed.point_notes) ? parsed.point_notes : [],
    actionPoints: Array.isArray(parsed.action_points) ? parsed.action_points : [],
  };
};

// Groq hosts Whisper large-v3 on a free tier - same request shape as
// OpenAI's transcription endpoint, just a different host/key/model name.
const transcribeAudio = async (file: File): Promise<string> => {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("Transcription is not configured (missing GROQ_API_KEY).");

  const form = new FormData();
  form.append("file", file, file.name || "recording.webm");
  form.append("model", "whisper-large-v3");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper request failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return String(result.text || "");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Supabase function environment is not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "You must be signed in." }, 401);

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      // action=transcribe
      const form = await req.formData();
      const meetingId = String(form.get("meetingId") || "");
      const file = form.get("file");
      if (!meetingId || !(file instanceof File)) return json({ error: "meetingId and file are required." }, 400);

      const { data: meeting, error: meetingError } = await userClient
        .from("meetings")
        .select("id")
        .eq("id", meetingId)
        .single();
      if (meetingError || !meeting) return json({ error: "You do not have access to this meeting." }, 403);

      const transcript = await transcribeAudio(file);

      const extension = (file.name.split(".").pop() || "webm").toLowerCase();
      const recordingPath = `${meetingId}/${Date.now()}.${extension}`;
      const { error: uploadError } = await adminClient.storage
        .from("meeting-recordings")
        .upload(recordingPath, file, { contentType: file.type || "audio/webm" });
      if (uploadError) throw uploadError;

      const { error: updateError } = await adminClient
        .from("meetings")
        .update({ transcript, recording_path: recordingPath, updated_at: new Date().toISOString() })
        .eq("id", meetingId);
      if (updateError) throw updateError;

      return json({ transcript, recordingPath });
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "playback_url") {
      const meetingId = String(body.meetingId || "");
      if (!meetingId) return json({ error: "meetingId is required." }, 400);

      const { data: meeting, error: meetingError } = await userClient
        .from("meetings")
        .select("recording_path")
        .eq("id", meetingId)
        .single();
      if (meetingError || !meeting) return json({ error: "You do not have access to this meeting." }, 403);
      if (!meeting.recording_path) return json({ error: "No recording saved for this meeting." }, 404);

      const { data, error } = await adminClient.storage
        .from("meeting-recordings")
        .createSignedUrl(meeting.recording_path, 3600);
      if (error) throw error;

      return json({ url: data.signedUrl });
    }

    if (action === "summarize") {
      const meetingId = String(body.meetingId || "");
      const transcript = String(body.transcript || "").trim();
      const meetingTitle = String(body.meetingTitle || "Meeting");
      const people: MeetingPersonInput[] = Array.isArray(body.people) ? body.people : [];
      const agenda = String(body.agenda || "").trim();
      if (!meetingId || !transcript) return json({ error: "meetingId and transcript are required." }, 400);

      const { data: meeting, error: meetingError } = await userClient
        .from("meetings")
        .select("id")
        .eq("id", meetingId)
        .single();
      if (meetingError || !meeting) return json({ error: "You do not have access to this meeting." }, 403);

      const { minutes, pointNotes, actionPoints } = await summarizeTranscript(transcript, meetingTitle, people, agenda);
      return json({ minutes, pointNotes, actionPoints });
    }

    return json({ error: `Unknown action "${action}".` }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting AI request failed.";
    console.error("ACTSIX meeting-ai error", { message });
    return json({ error: message }, 500);
  }
});
