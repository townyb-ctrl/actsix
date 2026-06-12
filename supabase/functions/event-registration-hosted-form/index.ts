import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase function environment is not configured." }, 500);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return html("<h1>Registration form not found</h1>", 404);

  const { data: form, error } = await adminClient
    .from("event_registration_forms")
    .select("*, events(title, starts_at, location, cost_per_person)")
    .eq("public_token", token)
    .eq("status", "published")
    .maybeSingle();

  if (error || !form) return html("<h1>Registration form not available</h1><p>This form may be paused or unpublished.</p>", 404);

  if (req.method === "GET") {
    const eventTitle = escapeHtml(form.events?.title || form.title || "Event registration");
    return html(`<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${eventTitle}</title>
  <style>
    body{margin:0;background:#f7f4ee;color:#17212b;font-family:Inter,Arial,sans-serif}
    main{max-width:720px;margin:0 auto;padding:32px 18px}
    form{background:white;border:1px solid #e5ddd1;border-radius:18px;padding:22px;box-shadow:0 16px 40px rgba(23,33,43,.08)}
    label{display:block;margin-top:14px;font-size:13px;font-weight:800;color:#5c6470}
    input,textarea{box-sizing:border-box;width:100%;margin-top:6px;border:1px solid #ded6ca;border-radius:12px;padding:11px;font:inherit}
    button{margin-top:18px;border:0;border-radius:999px;background:#176b6b;color:white;padding:12px 18px;font-weight:900}
    .meta{color:#68717d;font-weight:600;line-height:1.6}
  </style>
</head>
<body>
  <main>
    <h1>${eventTitle}</h1>
    <p class="meta">${escapeHtml(form.events?.location || "")}${form.events?.starts_at ? ` · ${escapeHtml(new Date(form.events.starts_at).toLocaleDateString())}` : ""}</p>
    <form method="post">
      <label>Participant full name<input name="name" required /></label>
      <label>Email<input name="email" type="email" /></label>
      <label>Mobile<input name="mobile" /></label>
      <label>Parent / guardian name<input name="guardian_name" /></label>
      <label>Parent / guardian email<input name="guardian_email" type="email" /></label>
      <label>Emergency contact<input name="emergency_contact" /></label>
      <label>Notes<textarea name="notes" rows="4"></textarea></label>
      <label><input name="consent" type="checkbox" value="yes" style="width:auto" /> I confirm consent for this registration</label>
      <button type="submit">Submit registration</button>
    </form>
  </main>
</body>
</html>`);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const data = Object.fromEntries((await req.formData()).entries());
  const name = String(data.name || "").trim();
  if (!name) return html("<h1>Name is required</h1>", 400);

  const { error: insertError } = await adminClient.from("event_registrations").insert({
    workspace_id: form.workspace_id,
    event_id: form.event_id,
    person_id: null,
    status: form.settings?.approval_required ? "Interested" : "Registered",
    approval_status: form.settings?.approval_required ? "pending" : "not_required",
    amount_due: Number(form.events?.cost_per_person || 0),
    amount_paid: 0,
    payment_status: Number(form.events?.cost_per_person || 0) > 0 ? "pending" : "not_required",
    consent_form_received: data.consent === "yes",
    emergency_contact: String(data.emergency_contact || ""),
    notes: String(data.notes || ""),
    source: "actsix_hosted_form",
    imported_display_name: name,
    imported_email: String(data.email || ""),
    imported_mobile: String(data.mobile || ""),
    guardian_name: String(data.guardian_name || ""),
    guardian_email: String(data.guardian_email || ""),
  });

  if (insertError) return html(`<h1>Could not submit registration</h1><p>${escapeHtml(insertError.message)}</p>`, 500);
  return html("<h1>Registration received</h1><p>Thank you. The event team will follow up if anything else is needed.</p>");
});
