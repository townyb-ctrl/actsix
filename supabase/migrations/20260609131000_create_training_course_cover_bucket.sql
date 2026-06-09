insert into storage.buckets (id, name, public)
values ('training-course-covers', 'training-course-covers', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read training course covers'
  ) then
    create policy "Public can read training course covers"
      on storage.objects
      for select
      using (bucket_id = 'training-course-covers');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Workspace leaders can upload training course covers'
  ) then
    create policy "Workspace leaders can upload training course covers"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'training-course-covers'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Workspace leaders can update training course covers'
  ) then
    create policy "Workspace leaders can update training course covers"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'training-course-covers'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      )
      with check (
        bucket_id = 'training-course-covers'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor', 'group_leader')
        )
      );
  end if;
end $$;
