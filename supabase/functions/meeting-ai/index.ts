import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

// Meeting recording -> AI pipeline. Two actions, one function (they always
// run back to back from the same modal, no reason to split the file):
//
//   action=transcribe : multipart audio -> Storage + OpenAI Whisper -> transcript
//   action=summarize  : transcript text -> Claude -> minutes + action points
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
              "Minutes of meeting, formatted as numbered sections ('1. DISCUSSION') with numbered points under each ('1.1 ...'), matching what was actually discussed. Record the content of what people said, speaker by speaker, in reported speech - not a description of the topic. Never write that something 'was discussed', 'was raised', 'was reviewed' or that 'the team talked about' it: write the actual statements, figures, names, dates, amounts, reasons, objections, questions and answers, in the order they came up, quoting a short phrase verbatim where the wording matters. Someone who was not in the room must be able to read the point and know what was said, not merely what it was about. Do not invent content that was not said.",
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

// Groq also hosts free chat models with OpenAI-style tool calling - Llama
// 3.3 70B is a solid, free fit for this kind of structured extraction.
const summarizeTranscript = async (
  transcript: string,
  meetingTitle: string,
  people: MeetingPersonInput[],
  agenda: string,
): Promise<{ minutes: string; pointNotes: PointNote[]; actionPoints: ActionPointProposal[] }> => {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("AI minutes generation is not configured (missing GROQ_API_KEY).");

  const peopleList = people.length
    ? people.map((person) => `- ${person.name} (id: ${person.id})`).join("\n")
    : "(no meeting people on record)";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8000,
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
            `Transcript:\n${transcript}`,
            [
              "Write minutes of record, not an executive summary, and not a table of contents.",
              "The test every line must pass: does it tell the reader WHAT WAS SAID, or only what the topic was? Topic labels are useless.",
              "",
              'Not acceptable: "The venue hire for the conference was discussed and a decision was made."',
              'Acceptable: "Sipho reported the hall quote came back at R4,500 for the Saturday, up from R3,800 last year. He asked whether the youth budget could carry the difference. Thandi said it could not without cutting the camp deposit, and suggested asking for the two-day rate instead. Sipho agreed to phone the hall on Thursday."',
              "",
              "Keep every number, date, name, amount, deadline, question, answer, objection and reason that was actually voiced, attributed to the person who said it. Quote a short phrase verbatim where the wording matters. Where the transcript is thin on a point, write the little that was said - never pad it, and never invent.",
            ].join("\n"),
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
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
