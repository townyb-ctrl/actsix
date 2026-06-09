create table if not exists public.training_lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete cascade,
  title text not null,
  content text not null default '',
  position integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists training_lessons_course_position_idx
  on public.training_lessons(course_id, position);

create index if not exists training_lessons_workspace_course_idx
  on public.training_lessons(workspace_id, course_id);

alter table public.training_lessons enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_lessons'
      and policyname = 'Workspace members can read training lessons'
  ) then
    create policy "Workspace members can read training lessons"
      on public.training_lessons
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_lessons.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_lessons'
      and policyname = 'Workspace leaders can create training lessons'
  ) then
    create policy "Workspace leaders can create training lessons"
      on public.training_lessons
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_lessons.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
        and exists (
          select 1
          from public.training_courses tc
          where tc.id = training_lessons.course_id
            and tc.workspace_id = training_lessons.workspace_id
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_lessons'
      and policyname = 'Workspace leaders can update training lessons'
  ) then
    create policy "Workspace leaders can update training lessons"
      on public.training_lessons
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_lessons.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_lessons.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_lessons'
      and policyname = 'Workspace leaders can delete training lessons'
  ) then
    create policy "Workspace leaders can delete training lessons"
      on public.training_lessons
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_lessons.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;
end $$;
