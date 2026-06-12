create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  status text not null default 'Registered' check (status in ('Interested', 'Registered', 'Confirmed', 'Cancelled')),
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  medical_form_received boolean not null default false,
  consent_form_received boolean not null default false,
  transport_needed boolean not null default false,
  emergency_contact text not null default '',
  notes text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (event_id, person_id)
);

create table if not exists public.event_collaborators (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role text not null default 'Collaborator',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (event_id, person_id)
);

create index if not exists event_registrations_event_status_idx
  on public.event_registrations(event_id, status, created_at);

create index if not exists event_registrations_person_id_idx
  on public.event_registrations(person_id);

create index if not exists event_collaborators_event_idx
  on public.event_collaborators(event_id, created_at);

create index if not exists event_collaborators_person_id_idx
  on public.event_collaborators(person_id);

alter table public.event_registrations enable row level security;
alter table public.event_collaborators enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['event_registrations', 'event_collaborators']
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
  foreach table_name in array array['event_registrations', 'event_collaborators']
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
          and exists (
            select 1 from public.people p
            where p.id = %I.person_id
              and p.workspace_id = %I.workspace_id
          )
        )',
        'Workspace leaders can manage ' || table_name,
        table_name,
        table_name,
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
