-- Venue Hire slice 13: cleaning, damage evidence, and handing the building back.
--
-- Two problems, both currently solved by someone remembering:
--
-- 1. Nobody records the state of a room before a hirer walks in, so an argument
--    about a bond is one person's word against another's. venue_walkthroughs is
--    that record: a note and photos, before and after, per space.
-- 2. Nothing tracks the work between a hire ending and the next service
--    starting. venue_turnaround_tasks is that list.
--
-- A cleaning slot that respects in-use spaces needs no schema of its own: a
-- turnaround task carries a space and a window, and the app compares it against
-- the bookings already in that space.

create table if not exists public.venue_walkthroughs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  user_id uuid not null,

  -- Null means the whole site rather than one room, same as the run sheet.
  space_id uuid null references public.venue_spaces(id) on delete set null,

  phase text not null check (phase in ('Before', 'After')),
  condition_notes text not null default '',

  -- Public URLs in the existing venue-space-photos bucket. An array rather than
  -- a photos table: they are only ever read as a set, and never on their own.
  photo_urls text[] not null default '{}',

  -- Who walked it. Free text, because it is often a volunteer who is not a user.
  walked_by text not null default '',
  walked_at timestamp with time zone not null default now(),

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_walkthroughs_notes_length check (char_length(condition_notes) <= 2000),
  constraint venue_walkthroughs_walked_by_length check (char_length(walked_by) <= 200)
);

create index if not exists venue_walkthroughs_hire_idx
  on public.venue_walkthroughs(hire_id, phase, walked_at);

create table if not exists public.venue_turnaround_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  user_id uuid not null,

  space_id uuid null references public.venue_spaces(id) on delete set null,

  title text not null,
  kind text not null default 'Turnaround' check (kind in ('Cleaning', 'Turnaround', 'Repair')),
  notes text not null default '',

  -- When the work is meant to happen. Null for "before the next service,
  -- whenever", which is how most of these are actually agreed.
  starts_at timestamp with time zone null,
  ends_at timestamp with time zone null,

  done boolean not null default false,
  done_at timestamp with time zone null,
  done_by text not null default '',
  sort_order integer not null default 0,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_turnaround_tasks_title_length check (char_length(title) between 1 and 200),
  constraint venue_turnaround_tasks_notes_length check (char_length(notes) <= 1000),
  -- Either both ends of the window or neither: a start with no end cannot be
  -- checked against a booking, so it would be a window that never clashes.
  constraint venue_turnaround_tasks_window check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

create index if not exists venue_turnaround_tasks_hire_idx
  on public.venue_turnaround_tasks(hire_id, done, sort_order);

alter table public.venue_walkthroughs enable row level security;
alter table public.venue_turnaround_tasks enable row level security;

do $$
declare
  target text;
begin
  foreach target in array array['venue_walkthroughs', 'venue_turnaround_tasks']
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
