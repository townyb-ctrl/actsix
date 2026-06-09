create table if not exists public.training_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assignment_id uuid not null references public.training_assignments(id) on delete cascade,
  lesson_id uuid not null references public.training_lessons(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  completed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  unique (assignment_id, lesson_id)
);

create index if not exists training_lesson_progress_assignment_idx
  on public.training_lesson_progress(assignment_id, completed_at);

create index if not exists training_lesson_progress_workspace_person_idx
  on public.training_lesson_progress(workspace_id, person_id);

alter table public.training_lesson_progress enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_lesson_progress'
      and policyname = 'Workspace members can read training lesson progress'
  ) then
    create policy "Workspace members can read training lesson progress"
      on public.training_lesson_progress
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_lesson_progress.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;

create or replace function public.set_my_training_lesson_completion(
  target_assignment_id uuid,
  target_lesson_id uuid,
  should_complete boolean
)
returns public.training_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_assignment public.training_assignments;
  lesson_record public.training_lessons;
  total_lessons integer;
  completed_lessons integer;
  next_progress integer;
  next_status text;
  updated_assignment public.training_assignments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select ta.*
    into target_assignment
  from public.training_assignments ta
  join public.people p
    on p.id = ta.person_id
   and p.workspace_id = ta.workspace_id
   and p.auth_user_id = auth.uid()
  join public.workspace_members wm
    on wm.workspace_id = ta.workspace_id
   and wm.auth_user_id = auth.uid()
   and wm.status = 'active'
  where ta.id = target_assignment_id;

  if target_assignment.id is null then
    raise exception 'Training assignment not found';
  end if;

  select tl.*
    into lesson_record
  from public.training_lessons tl
  where tl.id = target_lesson_id
    and tl.course_id = target_assignment.course_id
    and tl.workspace_id = target_assignment.workspace_id;

  if lesson_record.id is null then
    raise exception 'Training lesson not found';
  end if;

  if should_complete then
    insert into public.training_lesson_progress (
      workspace_id,
      assignment_id,
      lesson_id,
      person_id
    )
    values (
      target_assignment.workspace_id,
      target_assignment.id,
      lesson_record.id,
      target_assignment.person_id
    )
    on conflict (assignment_id, lesson_id)
    do update set completed_at = now();
  else
    delete from public.training_lesson_progress
    where assignment_id = target_assignment.id
      and lesson_id = lesson_record.id;
  end if;

  select count(*)
    into total_lessons
  from public.training_lessons
  where workspace_id = target_assignment.workspace_id
    and course_id = target_assignment.course_id;

  select count(*)
    into completed_lessons
  from public.training_lesson_progress
  where workspace_id = target_assignment.workspace_id
    and assignment_id = target_assignment.id;

  if total_lessons <= 0 then
    next_progress := target_assignment.progress;
  else
    next_progress := round((completed_lessons::numeric / total_lessons::numeric) * 100);
  end if;

  next_status := case
    when total_lessons > 0 and completed_lessons >= total_lessons then 'Complete'
    when next_progress > 0 then 'In Progress'
    else 'Not Started'
  end;

  update public.training_assignments
  set
    progress = next_progress,
    status = next_status,
    completed_at = case
      when next_status = 'Complete' then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = target_assignment.id
  returning * into updated_assignment;

  return updated_assignment;
end;
$$;

grant execute on function public.set_my_training_lesson_completion(uuid, uuid, boolean) to authenticated;
