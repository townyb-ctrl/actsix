alter table public.projects
  add column if not exists cover_image_url text null;

insert into storage.buckets (id, name, public)
values ('project-covers', 'project-covers', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read project covers'
  ) then
    create policy "Public can read project covers"
      on storage.objects
      for select
      using (bucket_id = 'project-covers');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Workspace members can upload project covers'
  ) then
    create policy "Workspace members can upload project covers"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'project-covers'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Workspace members can update project covers'
  ) then
    create policy "Workspace members can update project covers"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'project-covers'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        bucket_id = 'project-covers'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Workspace members can delete project covers'
  ) then
    create policy "Workspace members can delete project covers"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'project-covers'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;
