alter table public.event_registration_sheet_connections
  add column if not exists source_kind text not null default 'google_sheet'
    check (source_kind in ('google_sheet', 'google_form', 'unknown')),
  add column if not exists source_detected_at timestamp with time zone null,
  add column if not exists google_form_url text not null default '',
  add column if not exists next_sync_at timestamp with time zone null,
  add column if not exists automatic_sync_enabled boolean not null default false,
  add column if not exists notification_settings jsonb not null default '{"new_registrations":true,"review_required":true,"sync_failed":true}'::jsonb,
  add column if not exists person_matching_rules jsonb not null default '{"email":true,"mobile":true,"name":false,"auto_link_confident_matches":true}'::jsonb,
  add column if not exists readiness_rules jsonb not null default '{"require_consent":true,"require_medical":false,"require_payment":false,"require_emergency_contact":false}'::jsonb,
  add column if not exists transform_settings jsonb not null default '{}'::jsonb;

create table if not exists public.event_registration_sync_audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  connection_id uuid null references public.event_registration_sheet_connections(id) on delete cascade,
  import_run_id uuid null references public.event_registration_import_runs(id) on delete set null,
  actor_id uuid null references auth.users(id) on delete set null,
  action text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error')),
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists event_registration_sheet_connections_next_sync_idx
  on public.event_registration_sheet_connections(next_sync_at, status)
  where automatic_sync_enabled = true and status = 'connected';

create index if not exists event_registration_sync_audit_logs_event_idx
  on public.event_registration_sync_audit_logs(event_id, created_at desc);

alter table public.event_registration_sync_audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_registration_sync_audit_logs'
      and policyname = 'Workspace members can view event registration sync audit logs'
  ) then
    create policy "Workspace members can view event registration sync audit logs"
      on public.event_registration_sync_audit_logs
      for select
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = event_registration_sync_audit_logs.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_registration_sync_audit_logs'
      and policyname = 'Workspace editors can manage event registration sync audit logs'
  ) then
    create policy "Workspace editors can manage event registration sync audit logs"
      on public.event_registration_sync_audit_logs
      for all
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = event_registration_sync_audit_logs.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = event_registration_sync_audit_logs.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;
end $$;
