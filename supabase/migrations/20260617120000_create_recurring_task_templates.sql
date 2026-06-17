alter table public.tasks
  add column if not exists recurring_template_id uuid,
  add column if not exists recurring_occurrence_number integer;

create table if not exists public.recurring_task_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  project text not null default '',
  project_id uuid references public.projects(id) on delete set null,
  assigned_person_id uuid references public.people(id) on delete set null,
  priority text not null default 'Medium',
  context text not null default 'General',
  energy text not null default 'Medium',
  minutes integer not null default 15,
  tags text[] not null default '{}',
  first_due_date date not null,
  next_due_date date,
  frequency text not null default 'weekly' check (frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  interval integer not null default 1 check (interval > 0),
  end_condition text not null default 'never' check (end_condition in ('never', 'on_date', 'after_occurrences')),
  end_date date,
  end_after_occurrences integer check (end_after_occurrences is null or end_after_occurrences > 0),
  creation_mode text not null default 'on_completion' check (creation_mode in ('on_completion', 'ahead_of_time')),
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  generated_count integer not null default 0,
  last_generated_task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_recurring_template_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_recurring_template_id_fkey
      foreign key (recurring_template_id)
      references public.recurring_task_templates(id)
      on delete set null;
  end if;
end $$;

create index if not exists recurring_task_templates_user_id_idx
  on public.recurring_task_templates(user_id);

create index if not exists recurring_task_templates_status_next_due_idx
  on public.recurring_task_templates(status, next_due_date);

create index if not exists tasks_recurring_template_id_idx
  on public.tasks(recurring_template_id);

alter table public.recurring_task_templates enable row level security;

create policy "Users can read their recurring task templates"
  on public.recurring_task_templates
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create their recurring task templates"
  on public.recurring_task_templates
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their recurring task templates"
  on public.recurring_task_templates
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their recurring task templates"
  on public.recurring_task_templates
  for delete
  to authenticated
  using (user_id = auth.uid());
