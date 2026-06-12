create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  type text not null default 'Camp' check (type in ('Camp', 'Mission Trip', 'Retreat', 'Outreach', 'Conference')),
  status text not null default 'Planning' check (status in ('Planning', 'Open', 'Final Prep', 'Complete')),
  starts_at date not null,
  ends_at date not null,
  location text not null default '',
  owner text not null default '',
  budget numeric(12,2) not null default 0,
  received numeric(12,2) not null default 0,
  capacity integer not null default 0,
  registered integer not null default 0,
  notes text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.event_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.event_team_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  role text not null,
  name text not null default '',
  person_id uuid null references public.people(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.event_logistics_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists events_workspace_status_idx
  on public.events(workspace_id, status, starts_at);

create index if not exists event_checklist_items_event_sort_idx
  on public.event_checklist_items(event_id, sort_order, created_at);

create index if not exists event_team_roles_event_sort_idx
  on public.event_team_roles(event_id, sort_order, created_at);

create index if not exists event_logistics_items_event_sort_idx
  on public.event_logistics_items(event_id, sort_order, created_at);

alter table public.events enable row level security;
alter table public.event_checklist_items enable row level security;
alter table public.event_team_roles enable row level security;
alter table public.event_logistics_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'Workspace members can read events'
  ) then
    create policy "Workspace members can read events"
      on public.events
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = events.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'Workspace leaders can create events'
  ) then
    create policy "Workspace leaders can create events"
      on public.events
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = events.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'Workspace leaders can update events'
  ) then
    create policy "Workspace leaders can update events"
      on public.events
      for update
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = events.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      )
      with check (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = events.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'Workspace leaders can delete events'
  ) then
    create policy "Workspace leaders can delete events"
      on public.events
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = events.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['event_checklist_items', 'event_team_roles', 'event_logistics_items']
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
  foreach table_name in array array['event_checklist_items', 'event_team_roles', 'event_logistics_items']
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
