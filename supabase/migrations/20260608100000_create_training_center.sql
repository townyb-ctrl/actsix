create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  category text not null default 'General',
  description text not null default '',
  estimated_minutes integer not null default 30,
  status text not null default 'Active' check (status in ('Active', 'Draft', 'Archived')),
  suggested_audience text not null default '',
  modules text[] not null default '{}',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  assigned_by uuid not null,
  status text not null default 'Not Started' check (status in ('Not Started', 'In Progress', 'Complete')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  due_date date null,
  completed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (course_id, person_id)
);

create index if not exists training_courses_workspace_status_idx
  on public.training_courses(workspace_id, status, created_at desc);

create index if not exists training_assignments_workspace_status_idx
  on public.training_assignments(workspace_id, status, due_date);

create index if not exists training_assignments_course_id_idx
  on public.training_assignments(course_id);

create index if not exists training_assignments_person_id_idx
  on public.training_assignments(person_id);

alter table public.training_courses enable row level security;
alter table public.training_assignments enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_courses'
      and policyname = 'Workspace members can read training courses'
  ) then
    create policy "Workspace members can read training courses"
      on public.training_courses
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_courses.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_courses'
      and policyname = 'Workspace leaders can create training courses'
  ) then
    create policy "Workspace leaders can create training courses"
      on public.training_courses
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_courses.workspace_id
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
      and tablename = 'training_courses'
      and policyname = 'Workspace leaders can update training courses'
  ) then
    create policy "Workspace leaders can update training courses"
      on public.training_courses
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_courses.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_courses.workspace_id
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
      and tablename = 'training_courses'
      and policyname = 'Workspace leaders can delete training courses'
  ) then
    create policy "Workspace leaders can delete training courses"
      on public.training_courses
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_courses.workspace_id
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
      and tablename = 'training_assignments'
      and policyname = 'Workspace members can read training assignments'
  ) then
    create policy "Workspace members can read training assignments"
      on public.training_assignments
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_assignments.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_assignments'
      and policyname = 'Workspace leaders can create training assignments'
  ) then
    create policy "Workspace leaders can create training assignments"
      on public.training_assignments
      for insert
      to authenticated
      with check (
        assigned_by = auth.uid()
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_assignments.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
        and exists (
          select 1
          from public.training_courses tc
          where tc.id = training_assignments.course_id
            and tc.workspace_id = training_assignments.workspace_id
        )
        and exists (
          select 1
          from public.people p
          where p.id = training_assignments.person_id
            and p.workspace_id = training_assignments.workspace_id
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_assignments'
      and policyname = 'Workspace leaders can update training assignments'
  ) then
    create policy "Workspace leaders can update training assignments"
      on public.training_assignments
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_assignments.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_assignments.workspace_id
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
      and tablename = 'training_assignments'
      and policyname = 'Workspace leaders can delete training assignments'
  ) then
    create policy "Workspace leaders can delete training assignments"
      on public.training_assignments
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_assignments.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;
end $$;

insert into public.training_courses (
  workspace_id,
  user_id,
  title,
  category,
  description,
  estimated_minutes,
  status,
  suggested_audience,
  modules
)
select
  w.id,
  w.owner_user_id,
  seed.title,
  seed.category,
  seed.description,
  seed.estimated_minutes,
  seed.status,
  seed.suggested_audience,
  seed.modules
from public.workspaces w
cross join (
  values
    (
      'Worship Team Onboarding',
      'Worship Ministry',
      'Introduces new worship team members to the ministry vision, expectations, rehearsal culture, and Sunday serving rhythm.',
      45,
      'Active',
      'New worship team members, vocalists, musicians',
      array['Ministry vision', 'Rehearsal rhythm', 'Sunday expectations']::text[]
    ),
    (
      'Sound Desk Basics',
      'Production / Tech',
      'Covers gain structure, channel management, basic EQ, muting, monitor sends, and Sunday sound desk workflow.',
      60,
      'Active',
      'Production volunteers and new sound operators',
      array['Signal flow', 'EQ basics', 'Sunday desk workflow']::text[]
    ),
    (
      'Bible Study Leader Training',
      'Leadership',
      'Helps group leaders prepare passages, ask good questions, facilitate discussion, and care for people wisely.',
      90,
      'Draft',
      'Small group leaders and ministry coaches',
      array['Passage preparation', 'Good questions', 'Pastoral care']::text[]
    ),
    (
      'Child Safety Training',
      'Safety & Compliance',
      'Covers child safety policy, sign-in procedures, safe ratios, reporting concerns, and annual renewal expectations.',
      40,
      'Active',
      'Kids ministry volunteers and team leaders',
      array['Policy overview', 'Safe ratios', 'Reporting concerns']::text[]
    ),
    (
      'Membership Class',
      'Membership',
      'Introduces church beliefs, vision, membership expectations, baptism, communion, serving, and next steps.',
      120,
      'Active',
      'Prospective members and newcomers',
      array['Church vision', 'Beliefs and practices', 'Next steps']::text[]
    )
) as seed(title, category, description, estimated_minutes, status, suggested_audience, modules)
where not exists (
  select 1
  from public.training_courses existing
  where existing.workspace_id = w.id
    and existing.title = seed.title
);
