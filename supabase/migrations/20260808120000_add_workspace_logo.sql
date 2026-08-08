-- A workspace's logo, used on printed/exported documents (meeting minutes to
-- begin with). Mirrors the project-covers setup exactly: a public bucket whose
-- objects are workspace-scoped by their first path segment, so the storage
-- policies can check membership without a separate lookup table.

alter table public.workspaces
  add column if not exists logo_url text null;

insert into storage.buckets (id, name, public)
values ('workspace-logos', 'workspace-logos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read workspace logos'
  ) then
    create policy "Public can read workspace logos"
      on storage.objects
      for select
      using (bucket_id = 'workspace-logos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Workspace members can upload workspace logos'
  ) then
    create policy "Workspace members can upload workspace logos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'workspace-logos'
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
      and policyname = 'Workspace members can update workspace logos'
  ) then
    create policy "Workspace members can update workspace logos"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'workspace-logos'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        bucket_id = 'workspace-logos'
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
      and policyname = 'Workspace members can delete workspace logos'
  ) then
    create policy "Workspace members can delete workspace logos"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'workspace-logos'
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
