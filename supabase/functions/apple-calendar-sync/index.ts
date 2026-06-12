import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AppleSyncRequest = {
  workspace_id?: string;
  apple_id?: string;
  app_specific_password?: string;
  calendar_url?: string;
  account_label?: string;
  sync_direction?: "import_only" | "export_only" | "two_way";
};

type ParsedEvent = {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  description: string;
};

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const maskAppleId = (appleId: string) => {
  const [name, domain] = appleId.split("@");
  if (!domain) return appleId.length > 3 ? `${appleId.slice(0, 2)}...` : "Apple account";
  return `${name.slice(0, 2)}***@${domain}`;
};

const compactIcsText = (value: string) => value.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");

const parseIcsValue = (line: string) => {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return "";
  return line
    .slice(colonIndex + 1)
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
};

const parseIcsDate = (line: string) => {
  const raw = parseIcsValue(line);
  const allDay = /VALUE=DATE/i.test(line) || /^\d{8}$/.test(raw);

  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    return { value: new Date(Date.UTC(year, month, day)).toISOString(), allDay: true };
  }

  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!match) return { value: new Date().toISOString(), allDay };

  const [, year, month, day, hour, minute, second] = match;
  return {
    value: new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
    ).toISOString(),
    allDay,
  };
};

const parseCalendarData = (xml: string) => {
  const matches = [...xml.matchAll(/<[^>]*calendar-data[^>]*>([\s\S]*?)<\/[^>]*calendar-data>/gi)];
  return matches.map((match) => decodeXml(match[1]));
};

const parseEvents = (calendarDataBlocks: string[]): ParsedEvent[] => {
  return calendarDataBlocks.flatMap((block) => {
    const compact = compactIcsText(block);
    const eventBlocks = [...compact.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map((match) => match[1]);

    return eventBlocks
      .map((eventBlock) => {
        const lines = eventBlock.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const findLine = (name: string) => lines.find((line) => line.toUpperCase().startsWith(name));
        const uid = parseIcsValue(findLine("UID") || "");
        const starts = parseIcsDate(findLine("DTSTART") || "");
        const ends = parseIcsDate(findLine("DTEND") || "");

        if (!uid) return null;

        return {
          uid,
          title: parseIcsValue(findLine("SUMMARY") || "") || "Apple Calendar event",
          startsAt: starts.value,
          endsAt: ends.value,
          allDay: starts.allDay,
          location: parseIcsValue(findLine("LOCATION") || ""),
          description: parseIcsValue(findLine("DESCRIPTION") || ""),
        };
      })
      .filter(Boolean) as ParsedEvent[];
  });
};

const buildCalendarQuery = () => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 365);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  return `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${xmlEscape(stamp(start))}" end="${xmlEscape(stamp(end))}" />
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase function environment is not configured." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "You must be signed in to sync Apple Calendar." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = (await req.json()) as AppleSyncRequest;
  const workspaceId = body.workspace_id?.trim();
  const appleId = body.apple_id?.trim();
  const appPassword = body.app_specific_password?.trim();
  const calendarUrl = body.calendar_url?.trim();

  if (!workspaceId || !appleId || !appPassword || !calendarUrl) {
    return new Response(
      JSON.stringify({ error: "Apple ID, app-specific password, workspace, and CalDAV calendar URL are required." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    return new Response(JSON.stringify({ error: "You do not have access to this workspace." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const caldavResponse = await fetch(calendarUrl, {
    method: "REPORT",
    headers: {
      Authorization: `Basic ${btoa(`${appleId}:${appPassword}`)}`,
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: buildCalendarQuery(),
  });

  if (!caldavResponse.ok) {
    await adminClient.from("calendar_sync_connections").upsert(
      {
        workspace_id: workspaceId,
        user_id: userData.user.id,
        provider: "apple",
        account_label: body.account_label?.trim() || maskAppleId(appleId),
        status: "Needs Attention",
        sync_direction: body.sync_direction || "import_only",
        settings: {
          calendar_url: calendarUrl,
          apple_id_masked: maskAppleId(appleId),
          last_error: `Apple CalDAV returned ${caldavResponse.status}`,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,user_id,provider" }
    );

    return new Response(JSON.stringify({ error: `Apple CalDAV returned ${caldavResponse.status}.` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const xml = await caldavResponse.text();
  const parsedEvents = parseEvents(parseCalendarData(xml));
  let imported = 0;
  let updated = 0;

  for (const event of parsedEvents) {
    const { data: existing } = await adminClient
      .from("calendar_events")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("source", "apple")
      .eq("external_event_id", event.uid)
      .maybeSingle();

    const payload = {
      workspace_id: workspaceId,
      user_id: userData.user.id,
      title: event.title,
      calendar_name: "Apple Calendar",
      source: "apple",
      external_event_id: event.uid,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      all_day: event.allDay,
      location: event.location,
      description: event.description,
      status: "Confirmed",
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await adminClient.from("calendar_events").update(payload).eq("id", existing.id);
      if (!error) updated += 1;
    } else {
      const { error } = await adminClient.from("calendar_events").insert(payload);
      if (!error) imported += 1;
    }
  }

  const { error: connectionError } = await adminClient.from("calendar_sync_connections").upsert(
    {
      workspace_id: workspaceId,
      user_id: userData.user.id,
      provider: "apple",
      account_label: body.account_label?.trim() || maskAppleId(appleId),
      status: "Connected",
      last_synced_at: new Date().toISOString(),
      sync_direction: body.sync_direction || "import_only",
      settings: {
        calendar_url: calendarUrl,
        apple_id_masked: maskAppleId(appleId),
        imported_window: "30 days back, 365 days ahead",
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,user_id,provider" }
  );

  if (connectionError) {
    return new Response(JSON.stringify({ error: connectionError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ imported, updated, total: parsedEvents.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
