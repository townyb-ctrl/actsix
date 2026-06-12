import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase function environment is not configured." }, 500);
  if ((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") !== serviceRoleKey) {
    return json({ error: "Status sync requires service role authorization." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: queued, error } = await adminClient
    .from("event_registration_status_sync_queue")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return json({ error: error.message }, 500);

  for (const item of queued || []) {
    await adminClient
      .from("event_registration_status_sync_queue")
      .update({
        status: "skipped",
        error_message: "Writable provider is not connected yet. Queue item is preserved as provider-ready audit evidence.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    await adminClient.from("event_registration_sync_audit_logs").insert({
      workspace_id: item.workspace_id,
      event_id: item.event_id,
      connection_id: item.connection_id,
      actor_id: item.queued_by,
      action: "two_way_status_update_skipped",
      severity: "warning",
      message: "Status update was queued, but no writable external provider is connected yet.",
      metadata: item.payload,
    });
  }

  return json({ processed: queued?.length || 0 });
});
