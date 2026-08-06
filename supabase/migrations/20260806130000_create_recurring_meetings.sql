-- Recurring meeting series previously lived only in localStorage (per-browser,
-- never synced across devices or teammates). This makes them real
-- workspace-shared rows, mirroring the calendar/training migration pattern.

create table if not exists public.recurring_meeting_series (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  frequency text not null default 'Weekly' check (frequency in ('Weekly', 'Monthly')),
  start_date date null,
  meeting_time text null,
  location text not null default '',
  occurrences integer not null default 12,
  regular_attendees text[] not null default '{}',
  regular_agenda jsonb not null default '[]'::jsonb,
  people_group_id uuid null references public.people_groups(id) on delete set null,
  people_group_name text null,
  people_group_member_ids uuid[] not null default '{}',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Which computed occurrence slot (0-based index into the series) has already
-- had a real meetings row generated for it, and which one - the localStorage
-- "created map" made real and shared instead of per-browser.
create table if not exists public.recurring_meeting_occurrences (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.recurring_meeting_series(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  occurrence_index integer not null,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (series_id, occurrence_index)
);

create index if not exists recurring_meeting_series_workspace_idx
  on public.recurring_meeting_series(workspace_id, title);

create index if not exists recurring_meeting_occurrences_series_idx
  on public.recurring_meeting_occurrences(series_id);

alter table public.recurring_meeting_series enable row level security;
alter table public.recurring_meeting_occurrences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'recurring_meeting_series' and policyname = 'Workspace members can read recurring meeting series'
  ) then
    create policy "Workspace members can read recurring meeting series"
      on public.recurring_meeting_series
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = recurring_meeting_series.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'recurring_meeting_series' and policyname = 'Workspace members can manage recurring meeting series'
  ) then
    create policy "Workspace members can manage recurring meeting series"
      on public.recurring_meeting_series
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = recurring_meeting_series.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = recurring_meeting_series.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'recurring_meeting_occurrences' and policyname = 'Workspace members can read recurring meeting occurrences'
  ) then
    create policy "Workspace members can read recurring meeting occurrences"
      on public.recurring_meeting_occurrences
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = recurring_meeting_occurrences.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'recurring_meeting_occurrences' and policyname = 'Workspace members can manage recurring meeting occurrences'
  ) then
    create policy "Workspace members can manage recurring meeting occurrences"
      on public.recurring_meeting_occurrences
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = recurring_meeting_occurrences.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = recurring_meeting_occurrences.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;
