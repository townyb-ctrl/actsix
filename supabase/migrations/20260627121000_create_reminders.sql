create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  remind_at timestamp with time zone not null,
  end_at timestamp with time zone null,
  all_day boolean not null default false,
  location text not null default '',
  notes text not null default '',
  category text not null default 'General',
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  show_on_calendar boolean not null default true,
  calendar_event_id uuid null references public.calendar_events(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists reminders_user_remind_at_idx
  on public.reminders(user_id, remind_at, status);

create index if not exists reminders_workspace_remind_at_idx
  on public.reminders(workspace_id, remind_at);

alter table public.reminders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reminders' and policyname = 'Users can read their reminders'
  ) then
    create policy "Users can read their reminders"
      on public.reminders
      for select
      to authenticated
      using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reminders' and policyname = 'Users can create their reminders'
  ) then
    create policy "Users can create their reminders"
      on public.reminders
      for insert
      to authenticated
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = reminders.workspace_id
            and wm.auth_user_id = (select auth.uid())
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reminders' and policyname = 'Users can update their reminders'
  ) then
    create policy "Users can update their reminders"
      on public.reminders
      for update
      to authenticated
      using (user_id = (select auth.uid()))
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = reminders.workspace_id
            and wm.auth_user_id = (select auth.uid())
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reminders' and policyname = 'Users can delete their reminders'
  ) then
    create policy "Users can delete their reminders"
      on public.reminders
      for delete
      to authenticated
      using (user_id = (select auth.uid()));
  end if;
end $$;
