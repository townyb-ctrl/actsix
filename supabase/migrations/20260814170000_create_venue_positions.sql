-- Venue Hire slice 6: positions and who fills them.
--
-- Scope is deliberately narrow: put a person into a needed position for an
-- event. Pay, rates, hours, office-day swaps, leave and timesheets are handled
-- outside ACTSIX and are not modelled here.
--
-- Venues-local rather than an extension of the Service Planner rostering
-- tables: those are shaped around a service instance with team requirements,
-- and a hire is a different shape - a role needed for a stretch of time on a
-- particular day.

create table if not exists public.venue_position_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint venue_position_roles_name_length check (char_length(name) <= 80),
  constraint venue_position_roles_description_length check (char_length(description) <= 500),
  unique (workspace_id, name)
);

create table if not exists public.venue_positions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  user_id uuid not null,

  -- Restricted rather than cascaded: deleting a role that a live event still
  -- needs would quietly empty the board. Roles are deactivated instead.
  role_id uuid not null references public.venue_position_roles(id) on delete restrict,

  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  -- How many people this slot needs: 2 car guards at peak, 1 opener.
  needed integer not null default 1,
  notes text not null default '',

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_positions_ends_after_starts check (ends_at > starts_at),
  constraint venue_positions_needed_positive check (needed >= 1),
  constraint venue_positions_notes_length check (char_length(notes) <= 1000)
);

create table if not exists public.venue_position_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  position_id uuid not null references public.venue_positions(id) on delete cascade,
  user_id uuid not null,

  -- A church member from the directory, or a plain name for a freelancer or
  -- helper who is not in it. One of the two is always present.
  person_id uuid null references public.people(id) on delete set null,
  display_name text not null default '',

  notes text not null default '',
  created_at timestamp with time zone not null default now(),

  constraint venue_position_assignments_named check (
    person_id is not null or length(trim(display_name)) > 0
  ),
  constraint venue_position_assignments_display_name_length check (char_length(display_name) <= 200),
  constraint venue_position_assignments_notes_length check (char_length(notes) <= 500)
);

create index if not exists venue_position_roles_workspace_idx
  on public.venue_position_roles(workspace_id, sort_order, name);

create index if not exists venue_positions_hire_idx
  on public.venue_positions(hire_id, starts_at);

create index if not exists venue_position_assignments_position_idx
  on public.venue_position_assignments(position_id);

alter table public.venue_position_roles enable row level security;
alter table public.venue_positions enable row level security;
alter table public.venue_position_assignments enable row level security;

do $$
declare
  target record;
begin
  for target in
    select unnest(array[
      'venue_position_roles', 'venue_positions', 'venue_position_assignments'
    ]) as table_name
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = target.table_name
        and policyname = 'Workspace members manage venue records'
    ) then
      execute format($f$
        create policy %I on public.%I
          for all
          to authenticated
          using (
            exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = %I.workspace_id
                and wm.auth_user_id = auth.uid()
                and wm.status = 'active'
            )
          )
          with check (
            exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = %I.workspace_id
                and wm.auth_user_id = auth.uid()
                and wm.status = 'active'
            )
          )
      $f$, 'Workspace members manage venue records', target.table_name, target.table_name, target.table_name);
    end if;
  end loop;
end $$;

-- Seed the roles every hire needs, so the board is usable on first visit.
-- Only for workspaces that already model spaces - a workspace not doing venue
-- hire gets nothing. The unique (workspace_id, name) index makes this
-- re-runnable, and a church can rename, deactivate or add to them.
insert into public.venue_position_roles (workspace_id, user_id, name, description, sort_order)
select
  spaces.workspace_id,
  spaces.owner_id,
  role.name,
  role.description,
  role.sort_order
from (
  select s.workspace_id, (array_agg(s.user_id order by s.created_at, s.id))[1] as owner_id
  from public.venue_spaces s
  group by s.workspace_id
) spaces
cross join (
  values
    ('Opener', 'Unlocks, lights on, tech on.', 1),
    ('Technical', 'Sound, lighting, cameras, live feed.', 2),
    ('Operations', 'Walkie-talkie, floats, bathrooms, access, vendors.', 3),
    ('Car guard', 'Parking and traffic at peak times.', 4),
    ('Cleaner', 'Cleaning during and after the event.', 5),
    ('Closer', 'Final sweep, lights off, lock up.', 6)
) as role(name, description, sort_order)
on conflict (workspace_id, name) do nothing;
