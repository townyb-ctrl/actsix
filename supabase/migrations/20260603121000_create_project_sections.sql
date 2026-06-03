-- Add project sections so project actions can be grouped into ministry workstreams.

create table if not exists public.project_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  leader_person_id uuid null references public.people(id) on delete set null,
  status text not null default 'Active',
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.tasks
  add column if not exists section_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_section_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_section_id_fkey
      foreign key (section_id)
      references public.project_sections(id)
      on delete set null;
  end if;
end $$;

create index if not exists project_sections_project_sort_idx
  on public.project_sections(project_id, sort_order, created_at);

create index if not exists project_sections_leader_person_id_idx
  on public.project_sections(leader_person_id);

create index if not exists tasks_section_id_idx
  on public.tasks(section_id);

alter table public.project_sections enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_sections'
      and policyname = 'Project participants can read sections'
  ) then
    create policy "Project participants can read sections"
      on public.project_sections
      for select
      to authenticated
      using (public.can_access_project(project_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_sections'
      and policyname = 'Project participants can create sections'
  ) then
    create policy "Project participants can create sections"
      on public.project_sections
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and public.can_access_project(project_id)
        and (
          leader_person_id is null
          or exists (
            select 1
            from public.project_collaborators pc
            where pc.project_id = project_sections.project_id
              and pc.person_id = project_sections.leader_person_id
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_sections'
      and policyname = 'Project participants can update sections'
  ) then
    create policy "Project participants can update sections"
      on public.project_sections
      for update
      to authenticated
      using (public.can_access_project(project_id))
      with check (
        public.can_access_project(project_id)
        and (
          leader_person_id is null
          or exists (
            select 1
            from public.project_collaborators pc
            where pc.project_id = project_sections.project_id
              and pc.person_id = project_sections.leader_person_id
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_sections'
      and policyname = 'Project participants can delete sections'
  ) then
    create policy "Project participants can delete sections"
      on public.project_sections
      for delete
      to authenticated
      using (public.can_access_project(project_id));
  end if;
end $$;
