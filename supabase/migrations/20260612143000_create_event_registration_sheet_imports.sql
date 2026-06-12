alter table public.event_registrations
  alter column person_id drop not null,
  add column if not exists source text not null default 'manual',
  add column if not exists source_connection_id uuid null,
  add column if not exists source_row_id text null,
  add column if not exists source_row_number integer null,
  add column if not exists source_submitted_at timestamp with time zone null,
  add column if not exists imported_display_name text not null default '',
  add column if not exists imported_email text not null default '',
  add column if not exists imported_mobile text not null default '',
  add column if not exists custom_fields jsonb not null default '{}'::jsonb,
  add column if not exists review_status text not null default 'ready' check (review_status in ('ready', 'incomplete', 'review', 'duplicate', 'ignored')),
  add column if not exists review_reasons jsonb not null default '[]'::jsonb;

alter table public.event_registrations
  drop constraint if exists event_registrations_event_id_person_id_key;

create unique index if not exists event_registrations_event_person_unique_idx
  on public.event_registrations(event_id, person_id)
  where person_id is not null;

create unique index if not exists event_registrations_source_row_unique_idx
  on public.event_registrations(source_connection_id, source_row_id)
  where source_connection_id is not null and source_row_id is not null;

create index if not exists event_registrations_source_idx
  on public.event_registrations(event_id, source, review_status, created_at desc);

create table if not exists public.event_registration_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  provider text not null default 'google_sheets',
  spreadsheet_id text not null default '',
  spreadsheet_name text not null default '',
  spreadsheet_url text not null default '',
  worksheet_id text not null default '',
  worksheet_name text not null default '',
  header_row integer not null default 1,
  sync_mode text not null default 'manual' check (sync_mode in ('one_time', 'manual', 'automatic', 'paused')),
  sync_frequency_minutes integer null,
  status text not null default 'draft' check (status in ('draft', 'connected', 'needs_attention', 'paused', 'disconnected')),
  connected_by uuid null references auth.users(id) on delete set null,
  connected_google_account text not null default '',
  last_synced_at timestamp with time zone null,
  last_sync_summary jsonb not null default '{}'::jsonb,
  rows_imported integer not null default 0,
  rows_requiring_review integer not null default 0,
  access_revoked_at timestamp with time zone null,
  disconnected_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'event_registrations'
      and constraint_name = 'event_registrations_source_connection_id_fkey'
  ) then
    alter table public.event_registrations
      add constraint event_registrations_source_connection_id_fkey
      foreign key (source_connection_id)
      references public.event_registration_sheet_connections(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.event_registration_sheet_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  connection_id uuid not null references public.event_registration_sheet_connections(id) on delete cascade,
  actsix_field text not null,
  sheet_column text not null,
  field_type text not null default 'standard' check (field_type in ('standard', 'event_custom', 'system')),
  transform text not null default 'none',
  is_required boolean not null default false,
  is_sensitive boolean not null default false,
  visibility text not null default 'event_admins' check (visibility in ('event_admins', 'participant_managers', 'event_owner')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (connection_id, actsix_field)
);

create table if not exists public.event_registration_custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  field_key text not null,
  field_type text not null default 'text' check (field_type in ('text', 'number', 'date', 'boolean', 'select', 'multi_select', 'long_text')),
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  is_sensitive boolean not null default false,
  visibility text not null default 'event_admins' check (visibility in ('event_admins', 'participant_managers', 'event_owner')),
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (event_id, field_key)
);

create table if not exists public.event_registration_import_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  connection_id uuid not null references public.event_registration_sheet_connections(id) on delete cascade,
  started_by uuid null references auth.users(id) on delete set null,
  mode text not null default 'manual' check (mode in ('manual', 'one_time', 'automatic')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'cancelled')),
  rows_seen integer not null default 0,
  rows_imported integer not null default 0,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  rows_requiring_review integer not null default 0,
  error_message text not null default '',
  summary jsonb not null default '{}'::jsonb,
  started_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone null
);

create table if not exists public.event_registration_import_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  connection_id uuid null references public.event_registration_sheet_connections(id) on delete cascade,
  import_run_id uuid null references public.event_registration_import_runs(id) on delete cascade,
  registration_id uuid null references public.event_registrations(id) on delete cascade,
  issue_type text not null check (issue_type in ('duplicate', 'missing_required', 'person_match', 'mapping_missing', 'access_revoked', 'worksheet_missing', 'column_renamed', 'sensitive_field', 'other')),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'error')),
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  title text not null,
  detail text not null default '',
  raw_row jsonb not null default '{}'::jsonb,
  candidate_matches jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone null,
  resolved_by uuid null references auth.users(id) on delete set null
);

create index if not exists event_registration_sheet_connections_event_idx
  on public.event_registration_sheet_connections(event_id, status, created_at desc);

create index if not exists event_registration_sheet_mappings_connection_idx
  on public.event_registration_sheet_mappings(connection_id, created_at);

create index if not exists event_registration_custom_fields_event_idx
  on public.event_registration_custom_fields(event_id, sort_order, created_at);

create index if not exists event_registration_import_runs_connection_idx
  on public.event_registration_import_runs(connection_id, started_at desc);

create index if not exists event_registration_import_issues_event_idx
  on public.event_registration_import_issues(event_id, status, severity, created_at desc);

alter table public.event_registration_sheet_connections enable row level security;
alter table public.event_registration_sheet_mappings enable row level security;
alter table public.event_registration_custom_fields enable row level security;
alter table public.event_registration_import_runs enable row level security;
alter table public.event_registration_import_issues enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'event_registration_sheet_connections',
    'event_registration_sheet_mappings',
    'event_registration_custom_fields',
    'event_registration_import_runs',
    'event_registration_import_issues'
  ]
  loop
    begin
      execute format('
        create policy %I on public.%I
        for select to authenticated
        using (
          exists (
            select 1 from public.events e
            join public.workspace_members wm on wm.workspace_id = e.workspace_id
            where e.id = %I.event_id
              and wm.auth_user_id = auth.uid()
              and wm.status = ''active''
          )
        )',
        'Workspace members can read ' || table_name,
        table_name,
        table_name
      );
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'event_registration_sheet_connections',
    'event_registration_sheet_mappings',
    'event_registration_custom_fields',
    'event_registration_import_runs',
    'event_registration_import_issues'
  ]
  loop
    begin
      execute format('
        create policy %I on public.%I
        for all to authenticated
        using (
          exists (
            select 1 from public.events e
            join public.workspace_members wm on wm.workspace_id = e.workspace_id
            where e.id = %I.event_id
              and wm.auth_user_id = auth.uid()
              and wm.status = ''active''
              and wm.role in (''admin'', ''editor'', ''group_leader'')
          )
        )
        with check (
          exists (
            select 1 from public.events e
            join public.workspace_members wm on wm.workspace_id = e.workspace_id
            where e.id = %I.event_id
              and e.workspace_id = %I.workspace_id
              and wm.auth_user_id = auth.uid()
              and wm.status = ''active''
              and wm.role in (''admin'', ''editor'', ''group_leader'')
          )
        )',
        'Workspace leaders can manage ' || table_name,
        table_name,
        table_name,
        table_name,
        table_name
      );
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;

drop policy if exists "Workspace leaders can manage event_registrations" on public.event_registrations;

create policy "Workspace leaders can manage event_registrations"
  on public.event_registrations
  for all
  to authenticated
  using (
    exists (
      select 1 from public.events e
      join public.workspace_members wm on wm.workspace_id = e.workspace_id
      where e.id = event_registrations.event_id
        and wm.auth_user_id = auth.uid()
        and wm.status = 'active'
        and wm.role in ('admin', 'editor', 'group_leader')
    )
  )
  with check (
    exists (
      select 1 from public.events e
      join public.workspace_members wm on wm.workspace_id = e.workspace_id
      where e.id = event_registrations.event_id
        and e.workspace_id = event_registrations.workspace_id
        and wm.auth_user_id = auth.uid()
        and wm.status = 'active'
        and wm.role in ('admin', 'editor', 'group_leader')
    )
    and (
      event_registrations.person_id is null
      or exists (
        select 1 from public.people p
        where p.id = event_registrations.person_id
          and p.workspace_id = event_registrations.workspace_id
      )
    )
  );
