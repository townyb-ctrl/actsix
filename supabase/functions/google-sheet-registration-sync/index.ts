import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SyncRequest = {
  mode?: "preview" | "sync";
  connection_id?: string;
  sheet_url?: string;
  worksheet_name?: string;
  header_row?: number;
  automatic?: boolean;
};

type Mapping = {
  actsix_field: string;
  sheet_column: string;
  field_type: "standard" | "event_custom" | "system";
  transform: string;
  is_sensitive: boolean;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseSpreadsheetId = (urlOrId: string) => {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || urlOrId.trim();
};

const parseCsv = (csv: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }

    value += char;
  }

  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const getCell = (row: Record<string, string>, mappings: Mapping[], field: string) => {
  const normalizedField = field.toLowerCase();
  const mapping = mappings.find((item) => {
    const actsixField = item.actsix_field.toLowerCase();
    return actsixField === normalizedField || actsixField.includes(normalizedField) || normalizedField.includes(actsixField);
  });
  return mapping ? applyTransform(row[mapping.sheet_column] || "", mapping.transform) : "";
};

const truthy = (value: string) => /^(yes|y|true|complete|completed|received|paid)$/i.test(value.trim());

const normalisePayment = (value: string) => {
  const lower = value.toLowerCase();
  if (lower.includes("paid") && !lower.includes("deposit") && !lower.includes("partial")) return "paid";
  if (lower.includes("deposit") || lower.includes("partial")) return "partial";
  if (lower.includes("unpaid") || lower.includes("outstanding")) return "missing";
  return "";
};

const applyTransform = (value: string, transform: string) => {
  const clean = value.trim();
  const key = transform.toLowerCase();
  if (!clean) return "";
  if (key.includes("lower")) return clean.toLowerCase();
  if (key.includes("upper")) return clean.toUpperCase();
  if (key.includes("title")) {
    return clean.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }
  if (key.includes("yes/no")) return truthy(clean) ? "Yes" : "No";
  return clean;
};

const rowToObject = (headers: string[], row: string[]) =>
  headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header] = row[index] || "";
    return acc;
  }, {});

const detectSourceKind = (headers: string[], sheetName: string) => {
  const joined = `${sheetName} ${headers.join(" ")}`.toLowerCase();
  if (joined.includes("timestamp") || joined.includes("form responses") || joined.includes("submit another response")) return "google_form";
  return "google_sheet";
};

const minutesFromNow = (minutes?: number | null) => {
  if (!minutes || minutes <= 0) return null;
  return new Date(Date.now() + minutes * 60_000).toISOString();
};

const audit = async (
  adminClient: any,
  connection: any,
  action: string,
  message: string,
  options: { runId?: string; actorId?: string; severity?: "info" | "warning" | "error"; metadata?: Record<string, unknown> } = {},
) => {
  await adminClient.from("event_registration_sync_audit_logs").insert({
    workspace_id: connection.workspace_id,
    event_id: connection.event_id,
    connection_id: connection.id,
    import_run_id: options.runId || null,
    actor_id: options.actorId || null,
    action,
    severity: options.severity || "info",
    message,
    metadata: options.metadata || {},
  });
};

const notifyEventManagers = async (
  adminClient: any,
  connection: any,
  title: string,
  message: string,
  type = "event_registration_sync",
) => {
  const { data: memberships } = await adminClient
    .from("workspace_members")
    .select("auth_user_id, role")
    .eq("workspace_id", connection.workspace_id)
    .eq("status", "active")
    .in("role", ["admin", "editor", "group_leader"]);

  await Promise.all((memberships || []).map((member: any) =>
    adminClient.rpc("actsix_create_notification_for_user", {
      recipient_user_id: member.auth_user_id,
      actor_person_id: null,
      notification_title: title,
      notification_message: message,
      notification_type: type,
      notification_entity_type: "event",
      notification_entity_id: connection.event_id,
    })
  ));
};

const buildCsvUrl = (connection: any) => {
  const spreadsheetId = connection.spreadsheet_id || parseSpreadsheetId(connection.spreadsheet_url);
  if (!spreadsheetId) {
    throw new Error("No Google Sheet link or spreadsheet ID is saved for this connection.");
  }
  const sheet = encodeURIComponent(connection.worksheet_name || "Form Responses 1");
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
};

const fetchRows = async (connection: any) => {
  const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  const spreadsheetId = connection.spreadsheet_id || parseSpreadsheetId(connection.spreadsheet_url);

  if (apiKey && spreadsheetId) {
    const range = encodeURIComponent(`'${connection.worksheet_name || "Form Responses 1"}'`);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`);
    if (response.ok) {
      const json = await response.json();
      return (json.values || []) as string[][];
    }
  }

  if (!spreadsheetId) {
    throw new Error("No Google Sheet link or spreadsheet ID is saved for this connection.");
  }

  const response = await fetch(buildCsvUrl(connection));
  if (!response.ok) {
    throw new Error(`Google Sheets returned ${response.status}. Check sharing, sheet link, or API credentials.`);
  }

  return parseCsv(await response.text());
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase function environment is not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const body = (await req.json()) as SyncRequest;
  const serviceRoleAuth = authHeader.replace(/^Bearer\s+/i, "") === serviceRoleKey;
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if ((userError || !userData.user) && !serviceRoleAuth) {
    return jsonResponse({ error: "You must be signed in to sync registrations." }, 401);
  }

  if (body.mode === "preview") {
    if (!userData.user && !serviceRoleAuth) return jsonResponse({ error: "You must be signed in to preview registrations." }, 401);
    const sheetUrl = body.sheet_url?.trim();
    if (!sheetUrl) return jsonResponse({ error: "Google Sheet link is required." }, 400);

    try {
      const rows = await fetchRows({
        spreadsheet_id: "",
        spreadsheet_url: sheetUrl,
        worksheet_name: body.worksheet_name || "Form Responses 1",
      });
      const headerIndex = Math.max(0, Number(body.header_row || 1) - 1);
      const headers = rows[headerIndex] || [];
      const sample = rows[headerIndex + 1] || [];
      const columns = headers
        .map((header, index) => ({
          column: header || `Column ${index + 1}`,
          sample: sample[index] || "",
        }))
        .filter((item) => item.column.trim());

      return jsonResponse({ columns, row_count: Math.max(0, rows.length - headerIndex - 1) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not preview this Google Sheet.";
      return jsonResponse({ error: message }, 400);
    }
  }

  const connectionId = body.connection_id?.trim();
  if (!connectionId) return jsonResponse({ error: "connection_id is required." }, 400);

  const { data: connection, error: connectionError } = await adminClient
    .from("event_registration_sheet_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();

  if (connectionError || !connection) return jsonResponse({ error: connectionError?.message || "Connection not found." }, 404);

  if (!serviceRoleAuth || !body.automatic) {
    const { data: membership } = await adminClient
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", connection.workspace_id)
      .eq("auth_user_id", userData.user?.id)
      .eq("status", "active")
      .in("role", ["admin", "editor", "group_leader"])
      .maybeSingle();

    if (!membership) return jsonResponse({ error: "You do not have permission to sync this event." }, 403);
  }

  const { data: mappings, error: mappingError } = await adminClient
    .from("event_registration_sheet_mappings")
    .select("*")
    .eq("connection_id", connectionId);

  if (mappingError) return jsonResponse({ error: mappingError.message }, 500);
  if (!mappings?.length) return jsonResponse({ error: "No column mapping has been saved for this Sheet." }, 400);

  const { data: run, error: runError } = await adminClient
    .from("event_registration_import_runs")
    .insert({
      workspace_id: connection.workspace_id,
      event_id: connection.event_id,
      connection_id: connectionId,
      started_by: userData.user?.id || null,
      mode: body.automatic ? "automatic" : connection.sync_mode === "one_time" ? "one_time" : "manual",
      status: "running",
    })
    .select("id")
    .single();

  if (runError || !run) return jsonResponse({ error: runError?.message || "Could not create import run." }, 500);
  await audit(adminClient, connection, "sync_started", body.automatic ? "Automatic registration sync started." : "Manual registration sync started.", {
    runId: run.id,
    actorId: userData.user?.id || undefined,
    metadata: { mode: body.automatic ? "automatic" : connection.sync_mode },
  });

  try {
    const rows = await fetchRows(connection);
    const headerIndex = Math.max(0, Number(connection.header_row || 1) - 1);
    const headers = rows[headerIndex] || [];
    const dataRows = rows.slice(headerIndex + 1);
    const missingColumns = (mappings as Mapping[]).filter((mapping) => !headers.includes(mapping.sheet_column));
    const sourceKind = detectSourceKind(headers, connection.worksheet_name || "");
    const matchingRules = connection.person_matching_rules || {};
    const readinessRules = connection.readiness_rules || {};
    const notificationSettings = connection.notification_settings || {};

    if (missingColumns.length) {
      for (const mapping of missingColumns) {
      await adminClient.from("event_registration_import_issues").insert({
          workspace_id: connection.workspace_id,
          event_id: connection.event_id,
          connection_id: connectionId,
          import_run_id: run.id,
          issue_type: "mapping_missing",
          severity: "error",
          title: `Mapped column "${mapping.sheet_column}" could not be found.`,
          detail: `Review the mapping for ${mapping.actsix_field}.`,
        });
      }

      await adminClient.from("event_registration_import_runs").update({
        status: "failed",
        rows_seen: dataRows.length,
        error_message: "Mapped columns are missing.",
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      await adminClient.from("event_registration_sheet_connections").update({
        status: "needs_attention",
        rows_requiring_review: missingColumns.length,
        source_kind: sourceKind,
        source_detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", connectionId);
      await audit(adminClient, connection, "sync_failed", "Mapped columns are missing from the Sheet.", {
        runId: run.id,
        actorId: userData.user?.id || undefined,
        severity: "error",
        metadata: { missing_columns: missingColumns.map((item) => item.sheet_column) },
      });
      if (notificationSettings.sync_failed !== false) {
        await notifyEventManagers(adminClient, connection, "Event registration sync needs attention", "One or more mapped columns could not be found.");
      }

      return jsonResponse({ error: "One or more mapped columns could not be found.", missing_columns: missingColumns.map((item) => item.sheet_column) }, 400);
    }

    let imported = 0;
    let skipped = 0;
    let review = 0;
    let matched = 0;

    for (let index = 0; index < dataRows.length; index += 1) {
      const rowNumber = headerIndex + index + 2;
      const row = rowToObject(headers, dataRows[index]);
      const fullName = getCell(row, mappings as Mapping[], "First Name") || getCell(row, mappings as Mapping[], "Full Name") || getCell(row, mappings as Mapping[], "Name");
      const email = getCell(row, mappings as Mapping[], "Email");
      const mobile = getCell(row, mappings as Mapping[], "Mobile");
      const consent = truthy(getCell(row, mappings as Mapping[], "Consent Status"));
      const medical = truthy(getCell(row, mappings as Mapping[], "Medical Status")) || truthy(getCell(row, mappings as Mapping[], "Medical Form"));
      const emergencyContact = getCell(row, mappings as Mapping[], "Emergency contact");
      const payment = normalisePayment(getCell(row, mappings as Mapping[], "Payment Status"));
      const sourceRowId = `${rowNumber}:${email || mobile || fullName}`.toLowerCase();
      const reasons = [
        !email && !mobile ? "Missing email or mobile number" : "",
        readinessRules.require_consent !== false && !consent ? "Missing consent" : "",
        readinessRules.require_medical === true && !medical ? "Missing medical form" : "",
        readinessRules.require_payment === true && payment !== "paid" ? "Payment not marked paid" : "",
        readinessRules.require_emergency_contact === true && !emergencyContact ? "Missing emergency contact" : "",
      ].filter(Boolean);

      const { data: existingSource } = await adminClient
        .from("event_registrations")
        .select("id")
        .eq("source_connection_id", connectionId)
        .eq("source_row_id", sourceRowId)
        .maybeSingle();

      if (existingSource) {
        skipped += 1;
        continue;
      }

      const duplicateQuery = adminClient
        .from("event_registrations")
        .select("id, imported_display_name, imported_email, imported_mobile")
        .eq("event_id", connection.event_id);

      const { data: possibleDuplicates } = email
        ? await duplicateQuery.eq("imported_email", email).limit(3)
        : mobile
          ? await duplicateQuery.eq("imported_mobile", mobile).limit(3)
          : await duplicateQuery.eq("imported_display_name", fullName).limit(3);

      const isDuplicate = Boolean(possibleDuplicates?.length);
      let matchedPersonId: string | null = null;
      let matchConfidence = "";
      if (email && matchingRules.email !== false) {
        const { data: person } = await adminClient
          .from("people")
          .select("id")
          .eq("workspace_id", connection.workspace_id)
          .ilike("email", email)
          .maybeSingle();
        if (person?.id) {
          matchedPersonId = person.id;
          matchConfidence = "email";
        }
      }
      if (!matchedPersonId && mobile && matchingRules.mobile !== false) {
        const { data: person } = await adminClient
          .from("people")
          .select("id")
          .eq("workspace_id", connection.workspace_id)
          .ilike("phone_number", mobile)
          .maybeSingle();
        if (person?.id) {
          matchedPersonId = person.id;
          matchConfidence = "mobile";
        }
      }
      if (!matchedPersonId && fullName && matchingRules.name === true) {
        const { data: person } = await adminClient
          .from("people")
          .select("id")
          .eq("workspace_id", connection.workspace_id)
          .ilike("display_name", fullName)
          .maybeSingle();
        if (person?.id) {
          matchedPersonId = person.id;
          matchConfidence = "name";
        }
      }
      const customFields = (mappings as Mapping[])
        .filter((mapping) => mapping.field_type === "event_custom")
        .reduce<Record<string, string>>((acc, mapping) => {
          acc[mapping.actsix_field] = applyTransform(row[mapping.sheet_column] || "", mapping.transform);
          return acc;
        }, {});

      const reviewStatus = isDuplicate ? "duplicate" : reasons.length ? "incomplete" : "ready";
      if (reviewStatus !== "ready") review += 1;
      if (matchedPersonId) matched += 1;

      const { data: registration, error: registrationError } = await adminClient
        .from("event_registrations")
        .insert({
          workspace_id: connection.workspace_id,
          event_id: connection.event_id,
          person_id: matchingRules.auto_link_confident_matches === false ? null : matchedPersonId,
          status: "Registered",
          amount_due: 0,
          amount_paid: payment === "paid" ? 0 : 0,
          consent_form_received: consent,
          medical_form_received: medical,
          transport_needed: truthy(getCell(row, mappings as Mapping[], "Transport required")),
          emergency_contact: emergencyContact,
          notes: matchedPersonId ? `Matched existing person by ${matchConfidence}.` : "",
          source: "google_sheets",
          source_connection_id: connectionId,
          source_row_id: sourceRowId,
          source_row_number: rowNumber,
          imported_display_name: fullName,
          imported_email: email,
          imported_mobile: mobile,
          custom_fields: customFields,
          review_status: reviewStatus,
          review_reasons: reasons,
        })
        .select("id")
        .single();

      if (registrationError) {
        skipped += 1;
        await adminClient.from("event_registration_import_issues").insert({
          workspace_id: connection.workspace_id,
          event_id: connection.event_id,
          connection_id: connectionId,
          import_run_id: run.id,
          issue_type: "other",
          severity: "error",
          title: `Row ${rowNumber} could not be imported.`,
          detail: registrationError.message,
          raw_row: row,
        });
        continue;
      }

      imported += 1;

      if (isDuplicate || reasons.length) {
        await adminClient.from("event_registration_import_issues").insert({
          workspace_id: connection.workspace_id,
          event_id: connection.event_id,
          connection_id: connectionId,
          import_run_id: run.id,
          registration_id: registration.id,
          issue_type: isDuplicate ? "duplicate" : "missing_required",
          severity: isDuplicate ? "warning" : "info",
          title: isDuplicate ? "Possible duplicate registration" : "Registration needs review",
          detail: reasons.join(", ") || "A similar registration already exists for this event.",
          raw_row: row,
          candidate_matches: possibleDuplicates || [],
        });
      }

      if (matchedPersonId) {
        await adminClient.from("event_registration_import_issues").insert({
          workspace_id: connection.workspace_id,
          event_id: connection.event_id,
          connection_id: connectionId,
          import_run_id: run.id,
          registration_id: registration.id,
          issue_type: "person_match",
          severity: "info",
          status: "resolved",
          title: "Matched existing person",
          detail: `Matched by ${matchConfidence}.`,
          raw_row: row,
          candidate_matches: [{ person_id: matchedPersonId, confidence: matchConfidence }],
          resolved_at: new Date().toISOString(),
          resolved_by: userData.user?.id || null,
        });
      }
    }

    await adminClient.from("event_registration_import_runs").update({
      status: "completed",
      rows_seen: dataRows.length,
      rows_imported: imported,
      rows_skipped: skipped,
      rows_requiring_review: review,
      completed_at: new Date().toISOString(),
      summary: { imported, skipped, review, matched, source_kind: sourceKind },
    }).eq("id", run.id);

    await adminClient.from("event_registration_sheet_connections").update({
      status: review ? "needs_attention" : "connected",
      last_synced_at: new Date().toISOString(),
      next_sync_at: connection.automatic_sync_enabled ? minutesFromNow(connection.sync_frequency_minutes) : null,
      source_kind: sourceKind,
      source_detected_at: new Date().toISOString(),
      rows_imported: Number(connection.rows_imported || 0) + imported,
      rows_requiring_review: review,
      last_sync_summary: { imported, skipped, review, matched, source_kind: sourceKind },
      updated_at: new Date().toISOString(),
    }).eq("id", connectionId);
    await audit(adminClient, connection, "sync_completed", `Imported ${imported} registration${imported === 1 ? "" : "s"}.`, {
      runId: run.id,
      actorId: userData.user?.id || undefined,
      metadata: { imported, skipped, review, matched, source_kind: sourceKind },
    });
    if (imported > 0 && notificationSettings.new_registrations !== false) {
      await notifyEventManagers(adminClient, connection, `${imported} new event registration${imported === 1 ? "" : "s"}`, `${connection.spreadsheet_name || "Google Sheet"} added new registrations.`);
    }
    if (review > 0 && notificationSettings.review_required !== false) {
      await notifyEventManagers(adminClient, connection, "Event registrations need review", `${review} imported registration${review === 1 ? "" : "s"} need attention.`);
    }

    return jsonResponse({ imported, skipped, review, matched, total: dataRows.length, source_kind: sourceKind });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Sheet sync failed.";
    await adminClient.from("event_registration_import_runs").update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    await adminClient.from("event_registration_sheet_connections").update({
      status: "needs_attention",
      last_sync_summary: { error: message },
      updated_at: new Date().toISOString(),
    }).eq("id", connectionId);
    await audit(adminClient, connection, "sync_failed", message, {
      runId: run.id,
      actorId: userData.user?.id || undefined,
      severity: "error",
    });
    if ((connection.notification_settings || {}).sync_failed !== false) {
      await notifyEventManagers(adminClient, connection, "Event registration sync failed", message);
    }

    return jsonResponse({ error: message }, 500);
  }
});
