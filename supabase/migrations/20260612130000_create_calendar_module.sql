create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  calendar_name text not null default 'ACTSIX',
  source text not null default 'actsix' check (source in ('actsix', 'google', 'outlook', 'apple')),
  external_event_id text null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  all_day boolean not null default false,
  location text not null default '',
  description text not null default '',
  status text not null default 'Confirmed' check (status in ('Tentative', 'Confirmed', 'Cancelled')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.calendar_sync_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  provider text not null check (provider in ('google', 'outlook', 'apple')),
  account_label text not null default '',
  status text not null default 'Not Connected' check (status in ('Not Connected', 'Connected', 'Needs Attention')),
  last_synced_at timestamp with time zone null,
  sync_direction text not null default 'two_way' check (sync_direction in ('import_only', 'export_only', 'two_way')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (workspace_id, user_id, provider)
);

create index if not exists calendar_events_workspace_start_idx
  on public.calendar_events(workspace_id, starts_at, source);

create index if not exists calendar_events_external_idx
  on public.calendar_events(source, external_event_id);

create index if not exists calendar_sync_connections_workspace_idx
  on public.calendar_sync_connections(workspace_id, user_id, provider);

alter table public.calendar_events enable row level security;
alter table public.calendar_sync_connections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'Workspace members can read calendar events'
  ) then
    create policy "Workspace members can read calendar events"
      on public.calendar_events
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = calendar_events.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'Workspace members can manage calendar events'
  ) then
    create policy "Workspace members can manage calendar events"
      on public.calendar_events
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = calendar_events.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = calendar_events.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_sync_connections' and policyname = 'Workspace members can read calendar sync connections'
  ) then
    create policy "Workspace members can read calendar sync connections"
      on public.calendar_sync_connections
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = calendar_sync_connections.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_sync_connections' and policyname = 'Users can manage their calendar sync connections'
  ) then
    create policy "Users can manage their calendar sync connections"
      on public.calendar_sync_connections
      for all
      to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = calendar_sync_connections.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;
