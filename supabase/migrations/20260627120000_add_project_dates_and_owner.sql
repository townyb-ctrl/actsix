alter table public.projects
  add column if not exists owner_person_id uuid null references public.people(id) on delete set null,
  add column if not exists due_date date null,
  add column if not exists is_event boolean not null default false,
  add column if not exists event_start_at timestamp with time zone null,
  add column if not exists event_end_at timestamp with time zone null,
  add column if not exists calendar_event_id uuid null references public.calendar_events(id) on delete set null;

create index if not exists projects_owner_person_idx
  on public.projects(owner_person_id);

create index if not exists projects_due_date_idx
  on public.projects(due_date);

create index if not exists projects_event_start_idx
  on public.projects(event_start_at)
  where is_event = true;
