import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const responseHeaders = (contentType: string) => {
  const headers = new Headers();
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  headers.set("content-type", contentType);
  headers.set("x-content-type-options", "nosniff");
  return headers;
};

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: responseHeaders("text/html; charset=utf-8"),
  });

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders("application/json; charset=utf-8"),
  });

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));

const formatEventDate = (value?: string | null) => {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

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

  if (url.searchParams.get("format") === "json" && req.method === "GET") {
    return json({
      form: {
        id: form.id,
        title: form.title,
        settings: form.settings || {},
      },
      event: {
        title: form.events?.title || form.title || "Event registration",
        starts_at: form.events?.starts_at || null,
        location: form.events?.location || "",
        cost_per_person: Number(form.events?.cost_per_person || 0),
      },
    });
  }

  if (req.method === "GET") {
    const eventTitle = escapeHtml(form.events?.title || form.title || "Event registration");
    const eventDate = escapeHtml(formatEventDate(form.events?.starts_at));
    const eventLocation = escapeHtml(form.events?.location || "");
    const eventCost = Number(form.events?.cost_per_person || 0);
    const costLabel = eventCost > 0 ? `Cost: R${eventCost.toLocaleString("en-ZA")}` : "No payment required at registration";

    return html(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${eventTitle}</title>
  <style>
    :root{color-scheme:light;--teal:#176b6b;--ink:#17212b;--muted:#68717d;--line:#e5ddd1;--page:#f7f4ee;--card:#fff}
    *{box-sizing:border-box}
    body{margin:0;background:var(--page);color:var(--ink);font-family:Inter,Arial,sans-serif}
    main{max-width:760px;margin:0 auto;padding:28px 16px 40px}
    .hero{margin-bottom:16px;border:1px solid rgba(23,107,107,.16);border-radius:22px;background:linear-gradient(135deg,rgba(23,107,107,.1),rgba(255,255,255,.82));padding:22px;box-shadow:0 16px 40px rgba(23,33,43,.07)}
    .brand{font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--teal)}
    h1{margin:8px 0 8px;font-size:clamp(30px,7vw,46px);line-height:1.02;letter-spacing:-.02em}
    .meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;color:var(--muted);font-size:14px;font-weight:800;line-height:1.5}
    .pill{border:1px solid rgba(23,107,107,.18);border-radius:999px;background:white;padding:7px 10px}
    form{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 16px 40px rgba(23,33,43,.08)}
    .grid{display:grid;gap:14px}
    @media (min-width:680px){.grid.two{grid-template-columns:1fr 1fr}}
    label{display:block;margin-top:14px;font-size:13px;font-weight:900;color:#4f5964}
    input,textarea{width:100%;margin-top:7px;border:1px solid #ded6ca;border-radius:13px;background:#fffdf9;padding:12px;font:inherit;font-size:15px;outline:none;transition:border-color .15s,box-shadow .15s}
    input:focus,textarea:focus{border-color:rgba(23,107,107,.55);box-shadow:0 0 0 4px rgba(23,107,107,.11)}
    .consent{display:flex;gap:10px;align-items:flex-start;margin-top:16px;border:1px solid rgba(23,107,107,.16);border-radius:16px;background:rgba(23,107,107,.05);padding:12px}
    .consent input{width:auto;margin-top:2px}
    button{width:100%;margin-top:18px;border:0;border-radius:999px;background:var(--teal);color:white;padding:13px 18px;font-size:15px;font-weight:900;cursor:pointer}
    .hint{margin:12px 0 0;color:var(--muted);font-size:12px;font-weight:700;line-height:1.6}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="brand">ACTSIX Event Registration</div>
      <h1>${eventTitle}</h1>
      <div class="meta">
        ${eventLocation ? `<span class="pill">${eventLocation}</span>` : ""}
        ${eventDate ? `<span class="pill">${eventDate}</span>` : ""}
        <span class="pill">${escapeHtml(costLabel)}</span>
      </div>
    </section>
    <form method="post">
      <label>Participant full name<input name="name" autocomplete="name" required /></label>
      <div class="grid two">
        <label>Email<input name="email" type="email" autocomplete="email" /></label>
        <label>Mobile<input name="mobile" autocomplete="tel" /></label>
      </div>
      <div class="grid two">
        <label>Parent / guardian name<input name="guardian_name" autocomplete="name" /></label>
        <label>Parent / guardian email<input name="guardian_email" type="email" autocomplete="email" /></label>
      </div>
      <label>Emergency contact<input name="emergency_contact" /></label>
      <label>Notes<textarea name="notes" rows="4"></textarea></label>
      <label class="consent"><input name="consent" type="checkbox" value="yes" /> <span>I confirm consent for this registration and understand the event team may contact me for follow-up information.</span></label>
      <button type="submit">Submit registration</button>
      <p class="hint">Your registration will be sent to the event team in ACTSIX. If approval or payment is required, they will follow up with the next step.</p>
    </form>
  </main>
</body>
</html>`);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const isJsonSubmit = req.headers.get("content-type")?.includes("application/json") || url.searchParams.get("format") === "json";
  const data = isJsonSubmit ? await req.json() : Object.fromEntries((await req.formData()).entries());
  const name = String(data.name || "").trim();
  if (!name) {
    if (isJsonSubmit) return json({ error: "Name is required." }, 400);
    return html("<h1>Name is required</h1>", 400);
  }

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

  if (insertError) {
    if (isJsonSubmit) return json({ error: insertError.message }, 500);
    return html(`<h1>Could not submit registration</h1><p>${escapeHtml(insertError.message)}</p>`, 500);
  }

  if (isJsonSubmit) {
    return json({ ok: true, message: "Registration received." });
  }

  return html(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Registration received</title>
  <style>
    body{margin:0;background:#f7f4ee;color:#17212b;font-family:Inter,Arial,sans-serif}
    main{max-width:620px;margin:0 auto;padding:44px 18px}
    section{border:1px solid #e5ddd1;border-radius:22px;background:white;padding:26px;box-shadow:0 16px 40px rgba(23,33,43,.08)}
    h1{margin:0 0 8px;font-size:34px;line-height:1.05}
    p{color:#68717d;font-weight:700;line-height:1.7}
  </style>
</head>
<body><main><section><h1>Registration received</h1><p>Thank you. The event team will follow up if approval, payment, or extra information is needed.</p></section></main></body>
</html>`);
});
