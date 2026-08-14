-- Venue Hire slice 5: the run sheet.
--
-- This replaces the printed spreadsheet staff annotate by hand. For each hire,
-- per day, per space, per time slot: what is happening, what has to be set up,
-- what AV is needed, which doors are open, and what the risks are.
--
-- A run sheet item is finer-grained than a booking. One booking of the
-- auditorium from 08:00 to 22:00 can hold registration, a seminar, three
-- competition heats and a teardown - each its own item.

create table if not exists public.venue_run_sheet_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  user_id uuid not null,

  -- Null means the whole venue rather than one room: a car park marshal or a
  -- site-wide safety briefing belongs to no single space.
  space_id uuid null references public.venue_spaces(id) on delete set null,

  title text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,

  setup_notes text not null default '',
  av_notes text not null default '',
  access_notes text not null default '',
  risk_notes text not null default '',

  sort_order integer not null default 0,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_run_sheet_items_ends_after_starts check (ends_at > starts_at),
  constraint venue_run_sheet_items_title_length check (char_length(title) <= 200),
  constraint venue_run_sheet_items_setup_length check (char_length(setup_notes) <= 2000),
  constraint venue_run_sheet_items_av_length check (char_length(av_notes) <= 2000),
  constraint venue_run_sheet_items_access_length check (char_length(access_notes) <= 2000),
  constraint venue_run_sheet_items_risk_length check (char_length(risk_notes) <= 2000)
);

create index if not exists venue_run_sheet_items_hire_idx
  on public.venue_run_sheet_items(hire_id, starts_at, sort_order);

alter table public.venue_run_sheet_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_run_sheet_items'
      and policyname = 'Workspace members manage venue records'
  ) then
    create policy "Workspace members manage venue records"
      on public.venue_run_sheet_items
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = venue_run_sheet_items.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = venue_run_sheet_items.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;

-- Lessons worth carrying into the next time this event runs ("do it during the
-- school day", "be here Friday night"). Kept on the hire so a repeat hire
-- cloned from it starts with them attached.
alter table public.venue_hires
  add column if not exists lessons_learned text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venue_hires_lessons_length'
  ) then
    alter table public.venue_hires
      add constraint venue_hires_lessons_length check (char_length(lessons_learned) <= 4000);
  end if;
end $$;
