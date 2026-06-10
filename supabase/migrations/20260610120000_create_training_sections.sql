create table if not exists public.training_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  description text not null default '',
  position integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.training_courses
  add column if not exists section_id uuid null references public.training_sections(id) on delete set null;

create index if not exists training_sections_workspace_position_idx
  on public.training_sections(workspace_id, position, name);

create index if not exists training_courses_workspace_section_idx
  on public.training_courses(workspace_id, section_id, created_at desc);

alter table public.training_sections enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_sections'
      and policyname = 'Workspace members can read training sections'
  ) then
    create policy "Workspace members can read training sections"
      on public.training_sections
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_sections.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_sections'
      and policyname = 'Workspace leaders can create training sections'
  ) then
    create policy "Workspace leaders can create training sections"
      on public.training_sections
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_sections.workspace_id
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
      and tablename = 'training_sections'
      and policyname = 'Workspace leaders can update training sections'
  ) then
    create policy "Workspace leaders can update training sections"
      on public.training_sections
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_sections.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_sections.workspace_id
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
      and tablename = 'training_sections'
      and policyname = 'Workspace leaders can delete training sections'
  ) then
    create policy "Workspace leaders can delete training sections"
      on public.training_sections
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = training_sections.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;
end $$;
