alter table public.venue_spaces
  add column if not exists photo_urls text[] not null default '{}';

alter table public.venue_bookings
  add column if not exists requested_features text[] not null default '{}',
  add column if not exists needs_technician boolean not null default false,
  add column if not exists technician_fee numeric(10,2) not null default 0,
  add column if not exists coffee_requested boolean not null default false,
  add column if not exists coffee_fee numeric(10,2) not null default 0;

insert into storage.buckets (id, name, public)
values ('venue-space-photos', 'venue-space-photos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read venue space photos'
  ) then
    create policy "Public can read venue space photos"
      on storage.objects
      for select
      using (bucket_id = 'venue-space-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Workspace members can upload venue space photos'
  ) then
    create policy "Workspace members can upload venue space photos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'venue-space-photos'
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
      and policyname = 'Workspace members can update venue space photos'
  ) then
    create policy "Workspace members can update venue space photos"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'venue-space-photos'
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        bucket_id = 'venue-space-photos'
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
      and policyname = 'Workspace members can delete venue space photos'
  ) then
    create policy "Workspace members can delete venue space photos"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'venue-space-photos'
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
