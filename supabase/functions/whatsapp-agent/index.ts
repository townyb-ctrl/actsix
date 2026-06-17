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

const todayIso = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
};

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
    /^create\s+(?:a\s+)?task\s+called\s+["']?(.+?)["']?\.?$/i,
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

const isOpenTasksCommand = (message: string): boolean => {
  const normalized = message
    .toLowerCase()
    .replace(/['`]/g, "")
    .replace(/[?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!/\b(tasks?|to[- ]?dos?|todo)\b/.test(normalized)) return false;
  if (/\b(today|due today|for today)\b/.test(normalized)) return false;

  return (
    /\b(open|incomplete|all)\s+(?:my\s+)?(?:tasks?|to[- ]?dos?|todo)\b/.test(normalized) ||
    /\b(?:show|list)\s+(?:my\s+)?(?:open|incomplete|all)?\s*(?:tasks?|to[- ]?dos?|todo)\b/.test(normalized) ||
    /\bwhat\s+are\s+(?:my\s+)?(?:open|incomplete|all)?\s*(?:tasks?|to[- ]?dos?|todo)\b/.test(normalized) ||
    /\bwhat\s+(?:tasks?|to[- ]?dos?|todo)\s+do\s+i\s+have\b/.test(normalized)
  );
};

const wantsUpcomingServiceSongs = (message: string) =>
  /\b(songs?|set|setlist|worship)\b/i.test(message) && /\b(upcoming|next|service|sunday)\b/i.test(message);

const extractTaskBullets = (message: string): string[] => {
  const bullets = message
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*(?:[-\u2022*]|\d+[\.)])\s+(.+?)\s*$/);
      return match?.[1]?.trim() || "";
    })
    .filter((title) => title.length >= 3)
    .slice(0, 20);

  return bullets.length >= 2 ? bullets : [];
};

const isTeamThisWeekCommand = (message: string): boolean => {
  const normalized = message
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    /\bwho(?:s|se| is) on the team this week\b/.test(normalized) ||
    /\bwho(?:s| is) serving this week\b/.test(normalized) ||
    /\bwho(?:s| is) serving this sunday\b/.test(normalized) ||
    /\bworship team\b/.test(normalized) ||
    /\bteam this week\b/.test(normalized) ||
    /\bteam this sunday\b/.test(normalized) ||
    /\bserving this week\b/.test(normalized)
  );
};

const isGreetingCommand = (message: string): boolean => {
  const normalized = message
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /^(hi|hello|hey|good morning|good afternoon|good evening)$/.test(normalized);
};

const getSouthAfricaGreetingPeriod = (): "Good morning" | "Good afternoon" | "Good evening" => {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
};

const helpMessage =
  "Hi, I am the ACTSIX WhatsApp agent. Try: What are my tasks for today? | What are my open tasks? | What songs are in the set for the upcoming service? | Add \"Fetch kids\" to tasks";

type InboundMessage = {
  from: string;
  message: string;
  providerMessageId: string;
  profileName: string;
  phoneNumberId: string;
  isMeta: boolean;
  ignored: boolean;
  metadata: Record<string, unknown>;
};

type WhatsAppIdentity = {
  id: string;
  workspace_id: string;
  auth_user_id: string;
  person_id?: string | null;
  display_name?: string | null;
  people?: {
    first_name?: string | null;
    display_name?: string | null;
  } | null;
};

const extractMetaInbound = (body: any): InboundMessage | null => {
  const change = body?.entry?.[0]?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return null;
  if (message.type !== "text") {
    return {
      from: normalizePhone(message.from),
      message: "",
      providerMessageId: String(message.id || ""),
      profileName: String(value?.contacts?.[0]?.profile?.name || ""),
      phoneNumberId: String(value?.metadata?.phone_number_id || ""),
      isMeta: true,
      ignored: true,
      metadata: body,
    };
  }

  return {
    from: normalizePhone(message.from),
    message: String(message.text?.body || "").trim(),
    providerMessageId: String(message.id || ""),
    profileName: String(value?.contacts?.[0]?.profile?.name || ""),
    phoneNumberId: String(value?.metadata?.phone_number_id || ""),
    isMeta: true,
    ignored: false,
    metadata: body,
  };
};

const isMetaWebhookPayload = (body: any) => Boolean(body?.entry?.[0]?.changes?.[0]?.value);

const parseInbound = async (req: Request) => {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const metaInbound = extractMetaInbound(body);
    if (metaInbound) return metaInbound;
    if (isMetaWebhookPayload(body)) {
      return {
        from: "",
        message: "",
        providerMessageId: "",
        profileName: "",
        phoneNumberId: String(body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || ""),
        isMeta: true,
        ignored: true,
        metadata: body,
      };
    }

    return {
      from: normalizePhone(body.from || body.From || body.phone || body.phone_number),
      message: String(body.body || body.Body || body.message || "").trim(),
      providerMessageId: String(body.message_id || body.MessageSid || body.SmsMessageSid || ""),
      profileName: String(body.profile_name || body.name || ""),
      phoneNumberId: String(body.phone_number_id || ""),
      isMeta: false,
      ignored: false,
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
    profileName: "",
    phoneNumberId: "",
    isMeta: false,
    ignored: false,
    metadata,
  };
};

const sendMetaTextMessage = async (
  recipientPhone: string,
  message: string,
  inboundPhoneNumberId?: string,
) => {
  const accessToken = Deno.env.get("WHATSAPP_META_ACCESS_TOKEN");
  const fallbackPhoneNumberId = Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID");
  const phoneNumberId = inboundPhoneNumberId || fallbackPhoneNumberId;
  console.log("ACTSIX WhatsApp Meta send config", {
    hasAccessToken: Boolean(accessToken),
    hasPhoneNumberId: Boolean(phoneNumberId),
    phoneNumberIdSource: inboundPhoneNumberId ? "inbound_webhook" : "supabase_secret",
  });

  if (!accessToken || !phoneNumberId) {
    throw new Error("Meta WhatsApp environment is not configured.");
  }

  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone.replace(/[+\s]/g, ""),
      type: "text",
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  const responseText = await response.text();

  console.log("ACTSIX WhatsApp Meta send response", {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    throw new Error(`Meta WhatsApp send failed (${response.status}): ${responseText}`);
  }
};

const findIdentity = async (adminClient: ReturnType<typeof createClient>, phoneNumber: string) => {
  const { data, error } = await adminClient
    .from("whatsapp_agent_identities")
    .select("*, workspaces(name), people(first_name, display_name)")
    .eq("phone_number", phoneNumber)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const getTodayTasks = async (adminClient: ReturnType<typeof createClient>, identity: any) => {
  const personalTaskFilter = identity.person_id
    ? `user_id.eq.${identity.auth_user_id},assigned_person_id.eq.${identity.person_id}`
    : `user_id.eq.${identity.auth_user_id}`;

  const { data, error } = await adminClient
    .from("tasks")
    .select("title, due, priority, project")
    .eq("complete", false)
    .eq("due", todayIso())
    .or(personalTaskFilter)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  console.log("ACTSIX WhatsApp today tasks query complete", {
    count: data?.length || 0,
  });
  if (!data?.length) return "You have no open tasks due today.";

  return [
    `Tasks due today (${data.length}):`,
    ...data.map((task, index) => `${index + 1}. ${task.title}${task.project ? ` (${task.project})` : ""}`),
  ].join("\n");
};

const formatShortTaskDate = (value?: string | null) => {
  if (!value) return "No date";
  const today = todayIso();
  if (value === today) return "Today";

  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  if (value === tomorrowIso) return "Tomorrow";

  return new Date(`${value}T12:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
};

const getOpenTasks = async (adminClient: ReturnType<typeof createClient>, identity: WhatsAppIdentity): Promise<string> => {
  const personalTaskFilter = identity.person_id
    ? `user_id.eq.${identity.auth_user_id},assigned_person_id.eq.${identity.person_id}`
    : `user_id.eq.${identity.auth_user_id}`;

  const { data, error, count } = await adminClient
    .from("tasks")
    .select("title, due, priority, project", { count: "exact" })
    .eq("complete", false)
    .or(personalTaskFilter)
    .order("due", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  console.log("ACTSIX WhatsApp open tasks query complete", {
    count: data?.length || 0,
  });
  if (!data?.length) return "You have no open tasks right now.";

  const totalCount = count ?? data.length;
  const lines = [
    `You have ${totalCount} open tasks:`,
    "",
    ...data.map((task) => `\u2022 ${task.title}${task.project ? ` (${task.project})` : ""} \u2014 ${formatShortTaskDate(task.due)}`),
  ];

  if (totalCount > data.length) {
    lines.push("", "Showing the first 10.");
  }

  return lines.join("\n");
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

const getPreferredFirstName = (identity: WhatsAppIdentity) => {
  const linkedPerson = Array.isArray(identity.people) ? identity.people[0] : identity.people;
  const rawName = linkedPerson?.first_name || linkedPerson?.display_name || identity.display_name || "";
  const firstName = rawName.trim().split(/\s+/)[0] || "";
  return firstName;
};

const buildGreetingReply = (identity: WhatsAppIdentity): string => {
  const name = getPreferredFirstName(identity);
  const period = getSouthAfricaGreetingPeriod();
  const greetingLine = name ? `${period}, ${name}.` : `${period}.`;

  console.log("ACTSIX WhatsApp greeting reply generated", {
    hasName: Boolean(name),
  });

  return `${greetingLine}

What do you need?

You can ask me things like:
\u2022 What are my tasks for today?
\u2022 What are my open tasks?
\u2022 Who is on the team this week?

You can also send me a bullet list and I'll capture each item in your Inbox.`;
};

const createInboxItemsFromBullets = async (
  adminClient: ReturnType<typeof createClient>,
  identity: WhatsAppIdentity,
  bullets: string[],
): Promise<string> => {
  let createdCount = 0;

  for (const title of bullets) {
    const { error } = await adminClient.from("inbox_items").insert({
      id: crypto.randomUUID(),
      title,
      user_id: identity.auth_user_id,
      assigned_person_id: identity.person_id || null,
      notes: "Captured from WhatsApp.",
    });

    if (!error) createdCount += 1;
  }

  console.log("ACTSIX WhatsApp bulk inbox capture complete", {
    requestedCount: bullets.length,
    createdCount,
  });

  if (createdCount === bullets.length) {
    return [
      `Captured ${createdCount} inbox items:`,
      ...bullets.map((title) => `\u2022 ${title}`),
      "",
      "You can process them in ACTSIX Inbox.",
    ].join("\n");
  }

  if (createdCount > 0) {
    return `I captured ${createdCount} inbox items, but ${bullets.length - createdCount} could not be saved.`;
  }

  return "I could not capture those inbox items just now.";
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

const formatServiceDate = (value?: string | null) => {
  if (!value) return "No date";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const getUpcomingWorshipTeam = async (
  adminClient: ReturnType<typeof createClient>,
  identity: WhatsAppIdentity,
): Promise<string> => {
  const { data: service, error: serviceError } = await adminClient
    .from("service_instances")
    .select("id, title, service_date, start_time")
    .eq("user_id", identity.auth_user_id)
    .gte("service_date", todayIso())
    .order("service_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (serviceError) throw serviceError;

  if (!service) {
    console.log("ACTSIX WhatsApp upcoming worship team query complete", {
      foundService: false,
      memberCount: 0,
    });
    return "I could not find an upcoming service yet.";
  }

  const { data: assignments, error: assignmentError } = await adminClient
    .from("service_team_assignments")
    .select("role_name, person_name, sort_order")
    .eq("service_id", service.id)
    .eq("user_id", identity.auth_user_id)
    .order("sort_order", { ascending: true });

  if (assignmentError) throw assignmentError;

  const members = assignments || [];
  console.log("ACTSIX WhatsApp upcoming worship team query complete", {
    foundService: true,
    memberCount: members.length,
  });

  if (!members.length) return "I found the next service, but no worship team has been assigned yet.";

  const serviceTime = service.start_time ? `, ${service.start_time.slice(0, 5)}` : "";
  const serviceTitle = service.title ? `${service.title} — ` : "";

  return [
    `Next service: ${serviceTitle}${formatServiceDate(service.service_date)}${serviceTime}`,
    "",
    "Worship team:",
    ...members.map((member) => `• ${member.role_name || "Team"} — ${member.person_name}`),
  ].join("\n");
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

const hasProcessedProviderMessage = async (adminClient: ReturnType<typeof createClient>, providerMessageId: string) => {
  if (!providerMessageId) return false;

  const { data, error } = await adminClient
    .from("whatsapp_agent_messages")
    .select("id")
    .eq("direction", "inbound")
    .eq("provider_message_id", providerMessageId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};

const processCommand = async (adminClient: ReturnType<typeof createClient>, inbound: InboundMessage) => {
  let identity = null;
  let intent = "unknown";
  let reply = helpMessage;

  identity = await findIdentity(adminClient, inbound.from);
  if (!identity) {
    reply = "This WhatsApp number is not linked to ACTSIX yet. Ask a workspace admin to link your number first.";
    await logMessage(adminClient, null, inbound.from, "inbound", inbound.message, "unlinked", reply, inbound.providerMessageId, inbound.metadata);
    return { identity, intent: "unlinked", reply };
  }

  if (isGreetingCommand(inbound.message)) {
    intent = "greeting";
    reply = buildGreetingReply(identity);
  } else {
    const bullets = extractTaskBullets(inbound.message);
    if (bullets.length >= 2) {
      intent = "bulk_capture_inbox";
      reply = await createInboxItemsFromBullets(adminClient, identity, bullets);
    } else if (isTeamThisWeekCommand(inbound.message)) {
      intent = "upcoming_worship_team";
      reply = await getUpcomingWorshipTeam(adminClient, identity);
    } else if (wantsTodayTasks(inbound.message)) {
      intent = "today_tasks";
      reply = await getTodayTasks(adminClient, identity);
    } else if (isOpenTasksCommand(inbound.message)) {
      intent = "open_tasks";
      reply = await getOpenTasks(adminClient, identity);
    } else {
      const taskTitle = cleanTaskTitle(inbound.message);
      if (taskTitle) {
        intent = "add_task";
        reply = await addTask(adminClient, identity, taskTitle);
      } else if (wantsUpcomingServiceSongs(inbound.message)) {
        intent = "upcoming_service_songs";
        reply = await getUpcomingServiceSongs(adminClient, identity);
      }
    }
  }

  await logMessage(adminClient, identity, inbound.from, "inbound", inbound.message, intent, reply, inbound.providerMessageId, inbound.metadata);
  await logMessage(adminClient, identity, inbound.from, "outbound", reply, intent, reply, "", {
    response_to: inbound.providerMessageId,
    provider: inbound.isMeta ? "meta" : "json",
    profile_name: inbound.profileName,
    phone_number_id: inbound.phoneNumberId,
  });

  return { identity, intent, reply };
};

Deno.serve(async (req) => {
  console.log("ACTSIX WhatsApp request received", {
    method: req.method,
    contentType: req.headers.get("content-type"),
  });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    const url = new URL(req.url);

    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const expectedToken = Deno.env.get("WHATSAPP_META_VERIFY_TOKEN");

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
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase function environment is not configured." }, 500);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const inbound = await parseInbound(req);
  console.log("ACTSIX WhatsApp inbound parsed", {
    isMeta: inbound.isMeta,
    ignored: inbound.ignored,
    hasMessage: Boolean(inbound.message),
    hasProviderMessageId: Boolean(inbound.providerMessageId),
    hasPhoneNumberId: Boolean(inbound.phoneNumberId),
  });

  if (inbound.ignored) return json({ received: true, ignored: true });

  if (!inbound.isMeta) {
    if (!inbound.from || !inbound.message) return json({ reply: "I could not read that WhatsApp message." }, 400);

    try {
      const { reply } = await processCommand(adminClient, inbound);
      return json({ reply });
    } catch (error) {
      const message = error instanceof Error ? error.message : "WhatsApp agent failed.";
      console.error("ACTSIX WhatsApp send/process error", {
        message,
      });
      return json({ reply: "Sorry, I could not complete that ACTSIX request just now.", error: message }, 500);
    }
  }

  if (!inbound.providerMessageId || !inbound.message) return json({ received: true, ignored: true });

  let commandProcessed = false;

  try {
    if (await hasProcessedProviderMessage(adminClient, inbound.providerMessageId)) {
      return json({ received: true, duplicate: true });
    }

    const { reply } = await processCommand(adminClient, inbound);
    commandProcessed = true;
    console.log("ACTSIX WhatsApp sending reply", {
      hasRecipient: Boolean(inbound.from),
      replyLength: reply.length,
    });
    await sendMetaTextMessage(inbound.from, reply, inbound.phoneNumberId);
    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp agent failed.";
    if (!commandProcessed) {
      await logMessage(adminClient, null, inbound.from, "inbound", inbound.message, "error", message, inbound.providerMessageId, inbound.metadata);
    }
    console.error("ACTSIX WhatsApp send/process error", {
      message,
      hasInboundPhoneNumberId: Boolean(inbound.phoneNumberId),
    });

    return json(
      {
        received: true,
        error: "Reply send failed.",
      },
      200,
    );
  }
});
