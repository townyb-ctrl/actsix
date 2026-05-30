-- Preflight checks for:
-- supabase/migrations/20260530143000_harden_people_groups_projects.sql
--
-- Run this in the Supabase SQL Editor before applying the hardening migration.
-- Every result set should return zero rows, except the final summary.

-- 1. projects.id must be non-null.
select
  'projects_id_null' as check_name,
  id,
  user_id,
  name,
  created_at
from public.projects
where id is null;

-- 2. projects.id must be unique before it can become the primary key.
select
  'projects_id_duplicate' as check_name,
  id,
  count(*) as duplicate_count,
  array_agg(name order by created_at) as project_names
from public.projects
group by id
having count(*) > 1;

-- 3. projects.id must be castable to uuid before it can be referenced by project_collaborators.project_id.
select
  'projects_id_not_uuid' as check_name,
  id,
  user_id,
  name,
  created_at
from public.projects
where id is not null
  and id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 4. project collaborators must not reference missing projects.
with valid_projects as (
  select id::uuid as id
  from public.projects
  where id is not null
    and id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
)
select
  'orphaned_project_collaborator' as check_name,
  pc.id,
  pc.user_id,
  pc.project_id,
  pc.person_id,
  pc.created_at
from public.project_collaborators pc
left join valid_projects p on p.id = pc.project_id
where p.id is null;

-- 5. people.email must be unique per user when present.
select
  'people_email_duplicate_per_user' as check_name,
  user_id,
  lower(btrim(email)) as normalized_email,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as people_ids,
  array_agg(display_name order by created_at) as display_names
from public.people
where email is not null
  and btrim(email) <> ''
group by user_id, lower(btrim(email))
having count(*) > 1;

-- 6. people.auth_user_id must be unique per user when present.
select
  'people_auth_user_duplicate_per_user' as check_name,
  user_id,
  auth_user_id,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as people_ids,
  array_agg(display_name order by created_at) as display_names
from public.people
where auth_user_id is not null
group by user_id, auth_user_id
having count(*) > 1;

-- 7. Group membership must not be duplicated.
select
  'people_group_membership_duplicate' as check_name,
  user_id,
  group_id,
  person_id,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as membership_ids
from public.people_group_members
group by user_id, group_id, person_id
having count(*) > 1;

-- 8. Project collaborators must not be duplicated.
select
  'project_collaborator_duplicate' as check_name,
  user_id,
  project_id,
  person_id,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as collaborator_ids
from public.project_collaborators
group by user_id, project_id, person_id
having count(*) > 1;

-- Summary: all issue_count values should be 0 before applying the migration.
with checks as (
  select 'projects_id_null' as check_name, count(*) as issue_count
  from public.projects
  where id is null

  union all

  select 'projects_id_duplicate', count(*)
  from (
    select id
    from public.projects
    group by id
    having count(*) > 1
  ) duplicates

  union all

  select 'projects_id_not_uuid', count(*)
  from public.projects
  where id is not null
    and id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

  union all

  select 'orphaned_project_collaborator', count(*)
  from public.project_collaborators pc
  left join (
    select id::uuid as id
    from public.projects
    where id is not null
      and id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) p on p.id = pc.project_id
  where p.id is null

  union all

  select 'people_email_duplicate_per_user', count(*)
  from (
    select user_id, lower(btrim(email))
    from public.people
    where email is not null
      and btrim(email) <> ''
    group by user_id, lower(btrim(email))
    having count(*) > 1
  ) duplicates

  union all

  select 'people_auth_user_duplicate_per_user', count(*)
  from (
    select user_id, auth_user_id
    from public.people
    where auth_user_id is not null
    group by user_id, auth_user_id
    having count(*) > 1
  ) duplicates

  union all

  select 'people_group_membership_duplicate', count(*)
  from (
    select user_id, group_id, person_id
    from public.people_group_members
    group by user_id, group_id, person_id
    having count(*) > 1
  ) duplicates

  union all

  select 'project_collaborator_duplicate', count(*)
  from (
    select user_id, project_id, person_id
    from public.project_collaborators
    group by user_id, project_id, person_id
    having count(*) > 1
  ) duplicates
)
select *
from checks
order by check_name;
