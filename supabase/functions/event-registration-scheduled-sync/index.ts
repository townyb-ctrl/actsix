import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase function environment is not configured." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.replace(/^Bearer\s+/i, "") !== serviceRoleKey) {
    return jsonResponse({ error: "Scheduled sync requires service role authorization." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: dueConnections, error } = await adminClient
    .from("event_registration_sheet_connections")
    .select("id")
    .eq("automatic_sync_enabled", true)
    .eq("status", "connected")
    .or(`next_sync_at.is.null,next_sync_at.lte.${new Date().toISOString()}`)
    .limit(25);

  if (error) return jsonResponse({ error: error.message }, 500);

  const results = [];
  for (const connection of dueConnections || []) {
    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet-registration-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ connection_id: connection.id, automatic: true }),
    });
    const body = await response.json().catch(() => ({}));
    results.push({ connection_id: connection.id, ok: response.ok, status: response.status, body });
  }

  return jsonResponse({ processed: results.length, results });
});
