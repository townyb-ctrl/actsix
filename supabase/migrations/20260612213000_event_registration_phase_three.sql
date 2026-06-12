alter table public.event_registrations
  add column if not exists approval_status text not null default 'not_required'
    check (approval_status in ('not_required', 'pending', 'approved', 'rejected', 'waitlisted')),
  add column if not exists approval_notes text not null default '',
  add column if not exists approved_at timestamp with time zone null,
  add column if not exists approved_by uuid null references auth.users(id) on delete set null,
  add column if not exists guardian_name text not null default '',
  add column if not exists guardian_email text not null default '',
  add column if not exists guardian_phone text not null default '',
  add column if not exists portal_token text not null default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists portal_last_accessed_at timestamp with time zone null,
  add column if not exists payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'pending', 'paid', 'partial', 'failed', 'refunded')),
  add column if not exists payment_provider text not null default '',
  add column if not exists payment_reference text not null default '',
  add column if not exists payment_url text not null default '',
  add column if not exists external_status_synced_at timestamp with time zone null,
  add column if not exists external_status_sync_status text not null default 'not_configured'
    check (external_status_sync_status in ('not_configured', 'queued', 'synced', 'failed'));

create unique index if not exists event_registrations_portal_token_idx
  on public.event_registrations(portal_token);

create table if not exists public.event_registration_forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  form_type text not null check (form_type in ('actsix_hosted', 'google_form_template')),
  title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'archived')),
  public_token text not null default replace(gen_random_uuid()::text, '-', ''),
  google_form_url text not null default '',
  schema jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  published_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (public_token)
);

create table if not exists public.event_registration_payment_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual', 'payfast', 'stripe', 'yoco')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  currency text not null default 'ZAR',
  amount_strategy text not null default 'event_cost' check (amount_strategy in ('event_cost', 'fixed', 'custom_field')),
  fixed_amount numeric(12,2) not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (event_id)
);

create table if not exists public.event_registration_status_sync_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  connection_id uuid null references public.event_registration_sheet_connections(id) on delete set null,
  target text not null default 'google_sheet' check (target in ('google_sheet', 'google_form', 'payment_provider')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'synced', 'failed', 'skipped')),
  payload jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  queued_by uuid null references auth.users(id) on delete set null,
  processed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now()
);

create index if not exists event_registration_forms_event_idx
  on public.event_registration_forms(event_id, status, created_at desc);

create index if not exists event_registration_status_sync_queue_status_idx
  on public.event_registration_status_sync_queue(status, created_at);

alter table public.event_registration_forms enable row level security;
alter table public.event_registration_payment_configs enable row level security;
alter table public.event_registration_status_sync_queue enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'event_registration_forms',
    'event_registration_payment_configs',
    'event_registration_status_sync_queue'
  ]
  loop
    execute format('drop policy if exists "Workspace members can view %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Workspace leaders can manage %s" on public.%I', table_name, table_name);
    execute format('
      create policy "Workspace members can view %s"
      on public.%I
      for select
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = ''active''
        )
      )',
      table_name,
      table_name,
      table_name
    );
    execute format('
      create policy "Workspace leaders can manage %s"
      on public.%I
      for all
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = ''active''
            and wm.role in (''admin'', ''editor'', ''group_leader'')
        )
      )
      with check (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = ''active''
            and wm.role in (''admin'', ''editor'', ''group_leader'')
        )
      )',
      table_name,
      table_name,
      table_name,
      table_name
    );
  end loop;
end $$;
