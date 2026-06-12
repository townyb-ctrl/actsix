alter table public.events
  add column if not exists cost_per_person numeric(12,2) not null default 0;

alter table public.event_logistics_items
  add column if not exists assignee_person_id uuid null references public.people(id) on delete set null,
  add column if not exists status text not null default 'Open' check (status in ('Open', 'In Progress', 'Done')),
  add column if not exists notes text not null default '';

create table if not exists public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  amount numeric(12,2) not null default 0,
  spent_at date not null default current_date,
  paid_by_person_id uuid null references public.people(id) on delete set null,
  notes text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists event_logistics_items_assignee_idx
  on public.event_logistics_items(assignee_person_id);

create index if not exists event_expenses_event_spent_idx
  on public.event_expenses(event_id, spent_at desc, created_at desc);

create index if not exists event_expenses_paid_by_person_idx
  on public.event_expenses(paid_by_person_id);

alter table public.event_expenses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'event_expenses' and policyname = 'Workspace members can read event_expenses'
  ) then
    create policy "Workspace members can read event_expenses"
      on public.event_expenses
      for select
      to authenticated
      using (
        exists (
          select 1 from public.events e
          join public.workspace_members wm on wm.workspace_id = e.workspace_id
          where e.id = event_expenses.event_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'event_expenses' and policyname = 'Workspace leaders can manage event_expenses'
  ) then
    create policy "Workspace leaders can manage event_expenses"
      on public.event_expenses
      for all
      to authenticated
      using (
        exists (
          select 1 from public.events e
          join public.workspace_members wm on wm.workspace_id = e.workspace_id
          where e.id = event_expenses.event_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      )
      with check (
        exists (
          select 1 from public.events e
          join public.workspace_members wm on wm.workspace_id = e.workspace_id
          where e.id = event_expenses.event_id
            and e.workspace_id = event_expenses.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
        and (
          paid_by_person_id is null
          or exists (
            select 1 from public.people p
            where p.id = event_expenses.paid_by_person_id
              and p.workspace_id = event_expenses.workspace_id
          )
        )
      );
  end if;
end $$;
