begin;

-- 10.1 Make projects.id a real UUID primary key so other tables can safely reference it.
do $$
declare
  projects_id_type text;
begin
  select udt_name
  into projects_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'projects'
    and column_name = 'id';

  if exists (
    select 1
    from public.projects
    where id is null
  ) then
    raise exception 'Cannot add primary key to public.projects: projects.id contains null values.';
  end if;

  if projects_id_type <> 'uuid' then
    if exists (
      select 1
      from public.projects
      where id is not null
        and id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
      raise exception 'Cannot convert public.projects.id to uuid: non-UUID project ids exist.';
    end if;

    if exists (
      select 1
      from public.projects
      group by id::uuid
      having count(*) > 1
    ) then
      raise exception 'Cannot add primary key to public.projects: duplicate projects.id UUID values exist.';
    end if;

    alter table public.projects
      alter column id type uuid using id::uuid;
  else
    if exists (
      select 1
      from public.projects
      group by id
      having count(*) > 1
    ) then
      raise exception 'Cannot add primary key to public.projects: duplicate projects.id values exist.';
    end if;
  end if;
end $$;

alter table public.projects
  alter column id set not null;

do $$
declare
  id_is_primary_key boolean;
  id_is_unique boolean;
begin
  select exists (
    select 1
    from pg_constraint constraint_info
    join unnest(constraint_info.conkey) with ordinality key(attnum, ordinality) on true
    join pg_attribute column_info
      on column_info.attrelid = constraint_info.conrelid
      and column_info.attnum = key.attnum
    where constraint_info.conrelid = 'public.projects'::regclass
      and constraint_info.contype = 'p'
    group by constraint_info.oid
    having array_agg(column_info.attname::text order by key.ordinality) = array['id']
  )
  into id_is_primary_key;

  select exists (
    select 1
    from pg_constraint constraint_info
    join unnest(constraint_info.conkey) with ordinality key(attnum, ordinality) on true
    join pg_attribute column_info
      on column_info.attrelid = constraint_info.conrelid
      and column_info.attnum = key.attnum
    where constraint_info.conrelid = 'public.projects'::regclass
      and constraint_info.contype in ('p', 'u')
    group by constraint_info.oid
    having array_agg(column_info.attname::text order by key.ordinality) = array['id']
  )
  into id_is_unique;

  if not id_is_primary_key and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.projects'::regclass
      and contype = 'p'
  ) then
    alter table public.projects
      add constraint projects_pkey primary key (id);
    id_is_primary_key := true;
    id_is_unique := true;
  end if;

  if not id_is_unique then
    alter table public.projects
      add constraint projects_id_unique unique (id);
  end if;
end $$;

alter table public.projects
  alter column id set default gen_random_uuid();

-- Keep project collaborators tied to real projects now that projects.id is unique.
do $$
begin
  if exists (
    select 1
    from public.project_collaborators pc
    left join public.projects p on p.id::uuid = pc.project_id
    where p.id is null
  ) then
    raise exception 'Cannot add project collaborator foreign key: orphaned project_collaborators.project_id values exist.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.project_collaborators'::regclass
      and conname = 'project_collaborators_project_id_fkey'
  ) then
    alter table public.project_collaborators
      add constraint project_collaborators_project_id_fkey
      foreign key (project_id)
      references public.projects(id)
      on delete cascade;
  end if;
end $$;

-- 10.3 Add stronger uniqueness rules once data is clean.
do $$
begin
  if exists (
    select 1
    from public.people
    where email is not null
      and btrim(email) <> ''
    group by user_id, lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'Cannot add unique people email rule: duplicate non-null emails exist for at least one user.';
  end if;

  if exists (
    select 1
    from public.people
    where auth_user_id is not null
    group by user_id, auth_user_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add unique people auth_user_id rule: duplicate auth_user_id values exist for at least one user.';
  end if;

  if exists (
    select 1
    from public.people_group_members
    group by user_id, group_id, person_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add unique group membership rule: duplicate group memberships exist.';
  end if;

  if exists (
    select 1
    from public.project_collaborators
    group by user_id, project_id, person_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add unique project collaborator rule: duplicate project collaborators exist.';
  end if;
end $$;

create unique index if not exists people_user_email_unique_idx
  on public.people (user_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '';

create unique index if not exists people_user_auth_user_unique_idx
  on public.people (user_id, auth_user_id)
  where auth_user_id is not null;

create unique index if not exists people_group_members_unique_membership_idx
  on public.people_group_members (user_id, group_id, person_id);

create unique index if not exists project_collaborators_unique_person_idx
  on public.project_collaborators (user_id, project_id, person_id);

commit;
