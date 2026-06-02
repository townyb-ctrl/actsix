-- Share project-linked tasks with everyone who can access the project.
-- The existing tasks.project text column stays as the display/back-compat label;
-- project_id is the durable link used for shared project actions.

alter table public.tasks
  add column if not exists project_id uuid;

with ranked_matches as (
  select
    t.id as task_id,
    p.id as project_id,
    row_number() over (
      partition by t.id
      order by p.updated_at desc nulls last, p.created_at desc nulls last
    ) as match_rank
  from public.tasks t
  join public.projects p
    on p.user_id = t.user_id
   and lower(trim(p.name)) = lower(trim(t.project))
  where t.project_id is null
    and nullif(trim(t.project), '') is not null
)
update public.tasks t
set project_id = ranked_matches.project_id
from ranked_matches
where t.id = ranked_matches.task_id
  and ranked_matches.match_rank = 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_project_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_project_id_fkey
      foreign key (project_id)
      references public.projects(id)
      on delete set null;
  end if;
end $$;

create index if not exists tasks_project_id_idx
  on public.tasks (project_id);

create or replace function public.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_collaborators pc
    join public.people pe on pe.id = pc.person_id
    where pc.project_id = target_project_id
      and pe.auth_user_id = auth.uid()
  );
$$;

grant execute on function public.can_access_project(uuid) to authenticated;

create policy "Project collaborators can read project tasks"
  on public.tasks
  for select
  to authenticated
  using (
    project_id is not null
    and public.can_access_project(project_id)
  );

create policy "Project collaborators can create project tasks"
  on public.tasks
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      project_id is null
      or public.can_access_project(project_id)
    )
  );

create policy "Project collaborators can update project tasks"
  on public.tasks
  for update
  to authenticated
  using (
    project_id is not null
    and public.can_access_project(project_id)
  )
  with check (
    project_id is not null
    and public.can_access_project(project_id)
  );

create policy "Project collaborators can delete project tasks"
  on public.tasks
  for delete
  to authenticated
  using (
    project_id is not null
    and public.can_access_project(project_id)
  );
