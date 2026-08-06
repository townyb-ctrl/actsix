-- Workspace-scoped repository of frequently-used outside contacts (electricians,
-- plumbers, police, ambulance, social workers, etc.) with a lightweight usage
-- log so leaders can see when a contact was last used and what was done.

create table if not exists public.service_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  category text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  photo_url text null,
  last_used_at date null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.service_contact_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.service_contacts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  used_at date not null default current_date,
  description text not null default '',
  created_at timestamp with time zone not null default now()
);

create index if not exists service_contacts_workspace_idx
  on public.service_contacts(workspace_id, name);

create index if not exists service_contacts_category_idx
  on public.service_contacts(workspace_id, category);

create index if not exists service_contact_logs_contact_idx
  on public.service_contact_logs(contact_id, used_at desc);

alter table public.service_contacts enable row level security;
alter table public.service_contact_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'service_contacts' and policyname = 'Workspace members can read service contacts'
  ) then
    create policy "Workspace members can read service contacts"
      on public.service_contacts
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = service_contacts.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'service_contacts' and policyname = 'Workspace members can manage service contacts'
  ) then
    create policy "Workspace members can manage service contacts"
      on public.service_contacts
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = service_contacts.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = service_contacts.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'service_contact_logs' and policyname = 'Workspace members can read service contact logs'
  ) then
    create policy "Workspace members can read service contact logs"
      on public.service_contact_logs
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = service_contact_logs.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'service_contact_logs' and policyname = 'Workspace members can manage service contact logs'
  ) then
    create policy "Workspace members can manage service contact logs"
      on public.service_contact_logs
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = service_contact_logs.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = service_contact_logs.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;

-- Photo storage, mirroring the project-covers bucket/policy shape.
insert into storage.buckets (id, name, public)
values ('service-contact-photos', 'service-contact-photos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public can read service contact photos'
  ) then
    create policy "Public can read service contact photos"
      on storage.objects
      for select
      using (bucket_id = 'service-contact-photos');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Workspace members can upload service contact photos'
  ) then
    create policy "Workspace members can upload service contact photos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'service-contact-photos'
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Workspace members can update service contact photos'
  ) then
    create policy "Workspace members can update service contact photos"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'service-contact-photos'
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Workspace members can delete service contact photos'
  ) then
    create policy "Workspace members can delete service contact photos"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'service-contact-photos'
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id::text = (storage.foldername(name))[1]
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;
