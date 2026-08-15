-- Venue Hire slice 14: security cover, who gets in, and what went wrong.
--
-- Three gaps, one table each where a table is warranted:
--
-- 1. Security arrangements (car guards, their hours, the access plan) belong to
--    the hire and are one set of answers, so they are columns on venue_hires.
-- 2. Incidents are a log - many per hire, each with its own time - so a table.
-- 3. Emergency contacts for the day are a short list per hire. service_contacts
--    already holds the workspace's standing contact book (police, ambulance,
--    electrician) and is deliberately not duplicated: a hire contact may point
--    at one of those rows, or name somebody who only matters for this event.

alter table public.venue_hires
  add column if not exists security_required boolean not null default false,
  add column if not exists security_provider text not null default '',
  add column if not exists security_from timestamp with time zone null,
  add column if not exists security_to timestamp with time zone null,
  add column if not exists car_guards_required boolean not null default false,
  add column if not exists car_guard_count integer not null default 0,
  add column if not exists access_plan text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venue_hires_car_guard_count_positive'
  ) then
    alter table public.venue_hires
      add constraint venue_hires_car_guard_count_positive check (car_guard_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'venue_hires_security_window'
  ) then
    alter table public.venue_hires
      add constraint venue_hires_security_window check (
        security_from is null or security_to is null or security_to > security_from
      );
  end if;
end $$;

create table if not exists public.venue_incidents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  user_id uuid not null,

  space_id uuid null references public.venue_spaces(id) on delete set null,

  occurred_at timestamp with time zone not null default now(),
  severity text not null default 'Minor' check (severity in ('Minor', 'Serious', 'Critical')),
  category text not null default 'Other'
    check (category in ('Injury', 'Damage', 'Security', 'Behaviour', 'Equipment', 'Other')),

  summary text not null,
  action_taken text not null default '',
  reported_by text not null default '',

  -- An incident is closed when somebody has decided nothing more is needed.
  -- Left open by default: quietly closing one is how a pattern gets missed.
  resolved boolean not null default false,
  resolved_at timestamp with time zone null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_incidents_summary_length check (char_length(summary) between 1 and 1000),
  constraint venue_incidents_action_length check (char_length(action_taken) <= 2000),
  constraint venue_incidents_reported_by_length check (char_length(reported_by) <= 200)
);

create index if not exists venue_incidents_hire_idx
  on public.venue_incidents(hire_id, occurred_at desc);

create table if not exists public.venue_hire_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  user_id uuid not null,

  -- Points at the workspace's standing contact book when the number is already
  -- there. Null for somebody who only matters for this one event.
  service_contact_id uuid null,

  name text not null,
  role text not null default '',
  phone text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_hire_contacts_name_length check (char_length(name) between 1 and 200),
  constraint venue_hire_contacts_phone_length check (char_length(phone) <= 50)
);

create index if not exists venue_hire_contacts_hire_idx
  on public.venue_hire_contacts(hire_id, sort_order);

alter table public.venue_incidents enable row level security;
alter table public.venue_hire_contacts enable row level security;

do $$
declare
  target text;
begin
  foreach target in array array['venue_incidents', 'venue_hire_contacts']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = target
        and policyname = 'Workspace members manage venue records'
    ) then
      execute format(
        'create policy "Workspace members manage venue records"
           on public.%I
           for all
           to authenticated
           using (
             exists (
               select 1 from public.workspace_members wm
               where wm.workspace_id = %I.workspace_id
                 and wm.auth_user_id = auth.uid()
                 and wm.status = ''active''
             )
           )
           with check (
             exists (
               select 1 from public.workspace_members wm
               where wm.workspace_id = %I.workspace_id
                 and wm.auth_user_id = auth.uid()
                 and wm.status = ''active''
             )
           )',
        target, target, target
      );
    end if;
  end loop;
end $$;
