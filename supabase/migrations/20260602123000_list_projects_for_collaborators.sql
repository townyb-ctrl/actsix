-- Shared projects should appear anywhere the user lists projects, not only by direct link.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'Project collaborators can read shared projects'
  ) then
    create policy "Project collaborators can read shared projects"
      on public.projects
      for select
      to authenticated
      using (public.can_access_project(id));
  end if;
end $$;
