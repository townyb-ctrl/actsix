create or replace function public.get_event_workspace(p_event_id uuid)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
  with selected_event as (
    select e.*
    from public.events e
    where e.id = p_event_id
      and exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = e.workspace_id
          and wm.auth_user_id = auth.uid()
          and wm.status = 'active'
      )
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id,
      'workspaceId', e.workspace_id,
      'title', e.title,
      'type', e.type,
      'status', e.status,
      'startsAt', e.starts_at,
      'endsAt', e.ends_at,
      'location', e.location,
      'owner', e.owner,
      'budget', e.budget,
      'received', e.received,
      'costPerPerson', e.cost_per_person,
      'capacity', e.capacity,
      'registered', e.registered,
      'notes', e.notes,
      'checklist', coalesce(checklist.items, '[]'::jsonb),
      'team', coalesce(team.items, '[]'::jsonb),
      'logistics', coalesce(logistics.items, '[]'::jsonb),
      'registrations', coalesce(registrations.items, '[]'::jsonb),
      'collaborators', coalesce(collaborators.items, '[]'::jsonb),
      'expenses', coalesce(expenses.items, '[]'::jsonb),
      'sheetConnections', coalesce(sheet_connections.items, '[]'::jsonb),
      'registrationColumns', coalesce(registration_columns.items, '[]'::jsonb),
      'importRuns', coalesce(import_runs.items, '[]'::jsonb),
      'importIssues', coalesce(import_issues.items, '[]'::jsonb),
      'syncAuditLogs', coalesce(sync_audit_logs.items, '[]'::jsonb),
      'registrationForms', coalesce(registration_forms.items, '[]'::jsonb),
      'paymentConfig', payment_config.item,
      'statusSyncQueue', coalesce(status_sync_queue.items, '[]'::jsonb)
    )
  )
  from selected_event e
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'done', c.done) order by c.sort_order, c.created_at) as items
    from public.event_checklist_items c
    where c.event_id = e.id
  ) checklist on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('role', t.role, 'name', t.name) order by t.sort_order, t.created_at) as items
    from public.event_team_roles t
    where t.event_id = e.id
  ) team on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'label', l.label,
        'status', coalesce(l.status, 'Open'),
        'notes', coalesce(l.notes, ''),
        'assigneePersonId', l.assignee_person_id,
        'assignee', case when p.id is null then null else jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'email', p.email,
          'phone_number', p.phone_number,
          'avatar_url', p.avatar_url
        ) end
      )
      order by l.sort_order, l.created_at
    ) as items
    from public.event_logistics_items l
    left join public.people p on p.id = l.assignee_person_id
    where l.event_id = e.id
  ) logistics on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'personId', r.person_id,
        'status', r.status,
        'amountDue', r.amount_due,
        'amountPaid', r.amount_paid,
        'medicalFormReceived', r.medical_form_received,
        'consentFormReceived', r.consent_form_received,
        'transportNeeded', r.transport_needed,
        'emergencyContact', r.emergency_contact,
        'notes', r.notes,
        'source', coalesce(r.source, 'manual'),
        'sourceConnectionId', r.source_connection_id,
        'importedDisplayName', coalesce(r.imported_display_name, ''),
        'importedEmail', coalesce(r.imported_email, ''),
        'importedMobile', coalesce(r.imported_mobile, ''),
        'customFields', coalesce(r.custom_fields, '{}'::jsonb),
        'reviewStatus', coalesce(r.review_status, 'ready'),
        'reviewReasons', case when jsonb_typeof(coalesce(r.review_reasons, '[]'::jsonb)) = 'array' then r.review_reasons else '[]'::jsonb end,
        'approvalStatus', coalesce(r.approval_status, 'not_required'),
        'approvalNotes', coalesce(r.approval_notes, ''),
        'guardianName', coalesce(r.guardian_name, ''),
        'guardianEmail', coalesce(r.guardian_email, ''),
        'guardianPhone', coalesce(r.guardian_phone, ''),
        'portalToken', coalesce(r.portal_token, ''),
        'paymentStatus', coalesce(r.payment_status, 'not_required'),
        'paymentProvider', coalesce(r.payment_provider, ''),
        'paymentReference', coalesce(r.payment_reference, ''),
        'paymentUrl', coalesce(r.payment_url, ''),
        'externalStatusSyncStatus', coalesce(r.external_status_sync_status, 'not_configured'),
        'createdAt', r.created_at,
        'person', case when p.id is null then null else jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'email', p.email,
          'phone_number', p.phone_number,
          'avatar_url', p.avatar_url
        ) end
      )
      order by r.created_at
    ) as items
    from public.event_registrations r
    left join public.people p on p.id = r.person_id
    where r.event_id = e.id
  ) registrations on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'personId', c.person_id,
        'role', c.role,
        'person', jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'email', p.email,
          'phone_number', p.phone_number,
          'avatar_url', p.avatar_url
        )
      )
      order by c.created_at
    ) as items
    from public.event_collaborators c
    join public.people p on p.id = c.person_id
    where c.event_id = e.id
  ) collaborators on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'title', x.title,
        'category', x.category,
        'amount', x.amount,
        'spentAt', x.spent_at,
        'paidByPersonId', x.paid_by_person_id,
        'paidBy', case when p.id is null then null else jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'email', p.email,
          'phone_number', p.phone_number,
          'avatar_url', p.avatar_url
        ) end,
        'notes', coalesce(x.notes, '')
      )
      order by x.spent_at desc, x.created_at desc
    ) as items
    from public.event_expenses x
    left join public.people p on p.id = x.paid_by_person_id
    where x.event_id = e.id
  ) expenses on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'spreadsheetName', coalesce(s.spreadsheet_name, 'Google Sheet'),
        'spreadsheetUrl', coalesce(s.spreadsheet_url, ''),
        'worksheetName', coalesce(s.worksheet_name, 'Form Responses 1'),
        'syncMode', coalesce(s.sync_mode, 'manual'),
        'status', coalesce(s.status, 'draft'),
        'sourceKind', coalesce(s.source_kind, 'unknown'),
        'nextSyncAt', s.next_sync_at,
        'automaticSyncEnabled', coalesce(s.automatic_sync_enabled, false),
        'syncFrequencyMinutes', s.sync_frequency_minutes,
        'notificationSettings', coalesce(s.notification_settings, '{}'::jsonb),
        'personMatchingRules', coalesce(s.person_matching_rules, '{}'::jsonb),
        'readinessRules', coalesce(s.readiness_rules, '{}'::jsonb),
        'transformSettings', coalesce(s.transform_settings, '{}'::jsonb),
        'lastSyncedAt', s.last_synced_at,
        'rowsImported', s.rows_imported,
        'rowsRequiringReview', s.rows_requiring_review
      )
      order by s.created_at desc
    ) as items
    from public.event_registration_sheet_connections s
    where s.event_id = e.id
      and s.status <> 'disconnected'
  ) sheet_connections on true
  left join lateral (
    select jsonb_agg(column_item order by sort_order, label) as items
    from (
      select distinct on (lower(label))
        id,
        label,
        source_column as "sourceColumn",
        field_type as "fieldType",
        origin,
        sort_order as "sortOrder",
        jsonb_build_object(
          'id', id,
          'label', label,
          'sourceColumn', source_column,
          'fieldType', field_type,
          'origin', origin,
          'sortOrder', sort_order
        ) as column_item,
        sort_order
      from (
        select m.id, m.actsix_field as label, m.sheet_column as source_column, coalesce(m.field_type, 'event_custom') as field_type, 'sheet_mapping' as origin, 0 as sort_order
        from public.event_registration_sheet_mappings m
        where m.event_id = e.id
        union all
        select f.id, f.label, f.field_key as source_column, 'event_custom' as field_type, 'custom_field' as origin, coalesce(f.sort_order, 0) as sort_order
        from public.event_registration_custom_fields f
        where f.event_id = e.id
      ) columns
      order by lower(label), sort_order, label
    ) deduped
  ) registration_columns on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'connectionId', r.connection_id,
        'mode', coalesce(r.mode, 'manual'),
        'status', coalesce(r.status, 'completed'),
        'rowsSeen', r.rows_seen,
        'rowsImported', r.rows_imported,
        'rowsSkipped', r.rows_skipped,
        'rowsRequiringReview', r.rows_requiring_review,
        'errorMessage', coalesce(r.error_message, ''),
        'summary', coalesce(r.summary, '{}'::jsonb),
        'startedAt', r.started_at,
        'completedAt', r.completed_at
      )
      order by r.started_at desc
    ) as items
    from (
      select *
      from public.event_registration_import_runs
      where event_id = e.id
      order by started_at desc
      limit 60
    ) r
  ) import_runs on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'connectionId', i.connection_id,
        'importRunId', i.import_run_id,
        'issueType', i.issue_type,
        'severity', coalesce(i.severity, 'warning'),
        'status', coalesce(i.status, 'open'),
        'title', i.title,
        'detail', coalesce(i.detail, ''),
        'createdAt', i.created_at
      )
      order by i.created_at desc
    ) as items
    from (
      select *
      from public.event_registration_import_issues
      where event_id = e.id
      order by created_at desc
      limit 80
    ) i
  ) import_issues on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'connectionId', a.connection_id,
        'importRunId', a.import_run_id,
        'action', a.action,
        'severity', coalesce(a.severity, 'info'),
        'message', coalesce(a.message, ''),
        'metadata', coalesce(a.metadata, '{}'::jsonb),
        'createdAt', a.created_at
      )
      order by a.created_at desc
    ) as items
    from (
      select *
      from public.event_registration_sync_audit_logs
      where event_id = e.id
      order by created_at desc
      limit 80
    ) a
  ) sync_audit_logs on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'formType', f.form_type,
        'title', f.title,
        'status', f.status,
        'publicToken', f.public_token,
        'googleFormUrl', coalesce(f.google_form_url, ''),
        'schema', coalesce(f.schema, '{}'::jsonb),
        'settings', coalesce(f.settings, '{}'::jsonb),
        'createdAt', f.created_at
      )
      order by f.created_at desc
    ) as items
    from public.event_registration_forms f
    where f.event_id = e.id
  ) registration_forms on true
  left join lateral (
    select jsonb_build_object(
      'id', p.id,
      'provider', coalesce(p.provider, 'manual'),
      'status', coalesce(p.status, 'draft'),
      'currency', coalesce(p.currency, 'ZAR'),
      'amountStrategy', coalesce(p.amount_strategy, 'event_cost'),
      'fixedAmount', coalesce(p.fixed_amount, 0),
      'settings', coalesce(p.settings, '{}'::jsonb)
    ) as item
    from public.event_registration_payment_configs p
    where p.event_id = e.id
    limit 1
  ) payment_config on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'registrationId', q.registration_id,
        'status', coalesce(q.status, 'queued'),
        'target', coalesce(q.target, 'google_sheet'),
        'payload', coalesce(q.payload, '{}'::jsonb),
        'errorMessage', coalesce(q.error_message, ''),
        'createdAt', q.created_at
      )
      order by q.created_at desc
    ) as items
    from (
      select *
      from public.event_registration_status_sync_queue
      where event_id = e.id
      order by created_at desc
      limit 80
    ) q
  ) status_sync_queue on true;
$$;

grant execute on function public.get_event_workspace(uuid) to authenticated;
