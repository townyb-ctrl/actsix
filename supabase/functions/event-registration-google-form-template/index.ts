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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Supabase function environment is not configured." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "You must be signed in." }, 401);

  const { event_id } = await req.json();
  if (!event_id) return json({ error: "event_id is required." }, 400);

  const { data: event, error: eventError } = await adminClient.from("events").select("*").eq("id", event_id).maybeSingle();
  if (eventError || !event) return json({ error: eventError?.message || "Event not found." }, 404);

  const { data: membership } = await adminClient
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", event.workspace_id)
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .in("role", ["admin", "editor", "group_leader"])
    .maybeSingle();
  if (!membership) return json({ error: "You do not have permission to create this template." }, 403);

  const template = {
    title: `${event.title} Registration`,
    description: `Registration form for ${event.title}. Connect responses back to ACTSIX after creating the Google Form.`,
    questions: [
      { title: "Full Name", type: "short_answer", required: true },
      { title: "Email", type: "short_answer", required: false },
      { title: "Mobile", type: "short_answer", required: false },
      { title: "Parent / Guardian Name", type: "short_answer", required: false },
      { title: "Parent / Guardian Email", type: "short_answer", required: false },
      { title: "Emergency Contact", type: "short_answer", required: false },
      { title: "Consent Status", type: "multiple_choice", required: true, options: ["Yes", "No"] },
      { title: "Medical Notes", type: "paragraph", required: false },
      { title: "Transport Required", type: "multiple_choice", required: false, options: ["Yes", "No"] },
      { title: "Payment Status", type: "multiple_choice", required: false, options: ["Unpaid", "Deposit paid", "Paid"] },
    ],
  };

  const { data: form, error: formError } = await adminClient
    .from("event_registration_forms")
    .insert({
      workspace_id: event.workspace_id,
      event_id: event.id,
      form_type: "google_form_template",
      title: template.title,
      status: "draft",
      schema: template,
      settings: { provider_ready: true, requires_google_oauth: true },
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (formError) return json({ error: formError.message }, 500);
  return json({ form_id: form.id, template });
});
