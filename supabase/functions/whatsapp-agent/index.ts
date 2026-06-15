import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-actsix-webhook-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const twiml = (message: string, status = 200) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" },
  });

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char] || char));

const normalizePhone = (value?: string | null) => {
  const raw = (value || "").replace(/^whatsapp:/i, "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (/^0\d{9}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `+27${digits}`;
  if (/^27\d{9}$/.test(digits)) return `+${digits}`;
  if (raw.startsWith("+") && /^\+\d{8,15}$/.test(raw.replace(/\s/g, ""))) return raw.replace(/\s/g, "");
  return raw.startsWith("+") ? raw : `+${digits}`;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatDate = (value?: string | null) => {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

const cleanTaskTitle = (message: string) => {
  const patterns = [
    /^add\s+["']?(.+?)["']?\s+to\s+(?:my\s+)?tasks?\.?$/i,
    /^add\s+(?:a\s+)?task\s*[:\-]\s*["']?(.+?)["']?\.?$/i,
    /^add\s+["']?(.+?)["']?\.?$/i,
    /^task\s*[:\-]\s*["']?(.+?)["']?\.?$/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
  }

  return "";
};

const wantsTodayTasks = (message: string) =>
  /\b(tasks?|to[- ]?dos?|todo)\b/i.test(message) && /\b(today|due today|for today)\b/i.test(message);

const wantsUpcomingServiceSongs = (message: string) =>
  /\b(songs?|set|setlist|worship)\b/i.test(message) && /\b(upcoming|next|service|sunday)\b/i.test(message);

const helpMessage =
  "Hi, I am the ACTSIX WhatsApp agent. Try: What are my tasks for today? | What songs are in the set for the upcoming service? | Add \"Fetch kids\" to tasks";

const parseInbound = async (req: Request) => {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return {
      from: normalizePhone(body.from || body.From || body.phone || body.phone_number),
      message: String(body.body || body.Body || body.message || "").trim(),
      providerMessageId: String(body.message_id || body.MessageSid || body.SmsMessageSid || ""),
      responseMode: body.response_mode === "json" ? "json" : "twiml",
      metadata: body,
    };
  }

  const form = await req.formData();
  const metadata = Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name]),
  );
  return {
    from: normalizePhone(String(form.get("From") || form.get("WaId") || "")),
    message: String(form.get("Body") || "").trim(),
    providerMessageId: String(form.get("MessageSid") || form.get("SmsMessageSid") || ""),
    responseMode: "twiml",
    metadata,
  };
};

const findIdentity = async (adminClient: ReturnType<typeof createClient>, phoneNumber: string) => {
  const { data, error } = await adminClient
    .from("whatsapp_agent_identities")
    .select("*, workspaces(name)")
    .eq("phone_number", phoneNumber)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const getTodayTasks = async (adminClient: ReturnType<typeof createClient>, identity: any) => {
  const { data, error } = await adminClient
    .from("tasks")
    .select("title, due, priority, project")
    .eq("user_id", identity.auth_user_id)
    .eq("complete", false)
    .eq("due", todayIso())
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  if (!data?.length) return "You have no open tasks due today.";

  return [
    `Tasks due today (${data.length}):`,
    ...data.map((task, index) => `${index + 1}. ${task.title}${task.project ? ` (${task.project})` : ""}`),
  ].join("\n");
};

const addTask = async (adminClient: ReturnType<typeof createClient>, identity: any, title: string) => {
  const { error } = await adminClient.from("tasks").insert({
    id: crypto.randomUUID(),
    title,
    user_id: identity.auth_user_id,
    context: "General",
    priority: "Medium",
    energy: "Medium",
    minutes: 15,
    notes: "Added from WhatsApp.",
    project: "",
    project_id: null,
    tags: ["whatsapp"],
    assigned_person_id: identity.person_id || null,
    due: null,
    complete: false,
  });

  if (error) throw error;
  return `Added to your ACTSIX inbox: ${title}`;
};

const getUpcomingServiceSongs = async (adminClient: ReturnType<typeof createClient>, identity: any) => {
  const { data: service, error: serviceError } = await adminClient
    .from("service_instances")
    .select("id, title, service_date, start_time, location")
    .eq("user_id", identity.auth_user_id)
    .gte("service_date", todayIso())
    .order("service_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (serviceError) throw serviceError;
  if (!service) return "I could not find an upcoming service yet.";

  const { data: items, error: itemError } = await adminClient
    .from("service_order_items")
    .select("title, item_type, details, sort_order")
    .eq("service_id", service.id)
    .order("sort_order", { ascending: true });

  if (itemError) throw itemError;

  const songs = (items || []).filter((item) => {
    const haystack = `${item.item_type || ""} ${item.title || ""}`.toLowerCase();
    return haystack.includes("song") || haystack.includes("worship") || haystack.includes("music");
  });

  const serviceTitle = service.title || "Upcoming service";
  const heading = `${serviceTitle} (${formatDate(service.service_date)}${service.start_time ? ` ${service.start_time.slice(0, 5)}` : ""})`;
  if (!songs.length) return `${heading}\nNo songs are in the service order yet.`;

  return [heading, ...songs.map((song, index) => `${index + 1}. ${song.title}${song.details ? ` - ${song.details}` : ""}`)].join("\n");
};

const logMessage = async (
  adminClient: ReturnType<typeof createClient>,
  identity: any,
  phoneNumber: string,
  direction: "inbound" | "outbound",
  body: string,
  intent: string,
  responseBody: string,
  providerMessageId: string,
  metadata: Record<string, unknown>,
) => {
  await adminClient.from("whatsapp_agent_messages").insert({
    workspace_id: identity?.workspace_id || null,
    identity_id: identity?.id || null,
    phone_number: phoneNumber,
    direction,
    body,
    intent,
    response_body: responseBody,
    provider_message_id: providerMessageId,
    metadata,
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
  const url = new URL(req.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = Deno.env.get(70c702a9a1987ebc0b9873de3ae95f9a4cb653d3a6984ddc8a4fd742f8d0d7ea);

  if (
    mode === "subscribe" &&
    expectedToken &&
    token === expectedToken &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  console.error("Meta webhook verification failed", {
    mode,
    tokenMatches: token === expectedToken,
    hasChallenge: Boolean(challenge),
    hasExpectedToken: Boolean(expectedToken),
  });

  return new Response("Webhook verification failed", {
    status: 403,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("WHATSAPP_AGENT_WEBHOOK_SECRET") || "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase function environment is not configured." }, 500);

  if (webhookSecret && req.headers.get("x-actsix-webhook-secret") !== webhookSecret) {
    return json({ error: "Invalid WhatsApp webhook secret." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const inbound = await parseInbound(req);
  const respond = (message: string, status = 200) =>
    inbound.responseMode === "json" ? json({ reply: message }, status) : twiml(message, status);

  if (!inbound.from || !inbound.message) return respond("I could not read that WhatsApp message.", 400);

  let identity = null;
  let intent = "unknown";
  let reply = helpMessage;

  try {
    identity = await findIdentity(adminClient, inbound.from);
    if (!identity) {
      reply = "This WhatsApp number is not linked to ACTSIX yet. Ask a workspace admin to link your number first.";
      await logMessage(adminClient, null, inbound.from, "inbound", inbound.message, "unlinked", reply, inbound.providerMessageId, inbound.metadata);
      return respond(reply);
    }

    const taskTitle = cleanTaskTitle(inbound.message);
    if (taskTitle) {
      intent = "add_task";
      reply = await addTask(adminClient, identity, taskTitle);
    } else if (wantsTodayTasks(inbound.message)) {
      intent = "today_tasks";
      reply = await getTodayTasks(adminClient, identity);
    } else if (wantsUpcomingServiceSongs(inbound.message)) {
      intent = "upcoming_service_songs";
      reply = await getUpcomingServiceSongs(adminClient, identity);
    }

    await logMessage(adminClient, identity, inbound.from, "inbound", inbound.message, intent, reply, inbound.providerMessageId, inbound.metadata);
    await logMessage(adminClient, identity, inbound.from, "outbound", reply, intent, reply, "", { response_to: inbound.providerMessageId });
    return respond(reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp agent failed.";
    reply = "Sorry, I could not complete that ACTSIX request just now.";
    await logMessage(adminClient, identity, inbound.from, "inbound", inbound.message, "error", message, inbound.providerMessageId, inbound.metadata);
    return respond(reply, 500);
  }
});
