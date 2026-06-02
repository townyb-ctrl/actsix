-- Notify a collaborator when they are removed from a project.

create or replace function public.actsix_notify_project_collaborator_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  actor_name text;
begin
  select name into project_name from public.projects where id = old.project_id;

  select display_name
  into actor_name
  from public.people
  where auth_user_id = auth.uid()
  limit 1;

  actor_name := coalesce(actor_name, 'Someone');

  perform public.actsix_create_notification_for_person(
    old.person_id,
    null,
    'You were removed from a project',
    actor_name || ' removed you from ' || coalesce(project_name, 'a project') || '.',
    'project',
    'project',
    old.project_id::text
  );

  return old;
end;
$$;

drop trigger if exists actsix_project_collaborator_removed_notification on public.project_collaborators;
create trigger actsix_project_collaborator_removed_notification
after delete on public.project_collaborators
for each row
execute function public.actsix_notify_project_collaborator_removed();
