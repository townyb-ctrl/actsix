begin;

-- Remove project collaborator rows that point at projects that no longer exist.
-- These rows cannot be repaired by a foreign key because their parent project is gone.
with valid_projects as (
  select id::uuid as id
  from public.projects
  where id is not null
    and id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
),
orphaned_collaborators as (
  select pc.id
  from public.project_collaborators pc
  left join valid_projects p on p.id = pc.project_id
  where p.id is null
)
delete from public.project_collaborators pc
using orphaned_collaborators orphaned
where pc.id = orphaned.id;

-- Keep the earliest row for accidental duplicate project collaborators.
with ranked_collaborators as (
  select
    id,
    row_number() over (
      partition by user_id, project_id, person_id
      order by created_at nulls last, id
    ) as row_rank
  from public.project_collaborators
)
delete from public.project_collaborators pc
using ranked_collaborators ranked
where pc.id = ranked.id
  and ranked.row_rank > 1;

-- Keep the earliest row for accidental duplicate group memberships.
with ranked_memberships as (
  select
    id,
    row_number() over (
      partition by user_id, group_id, person_id
      order by created_at nulls last, id
    ) as row_rank
  from public.people_group_members
)
delete from public.people_group_members pgm
using ranked_memberships ranked
where pgm.id = ranked.id
  and ranked.row_rank > 1;

commit;
