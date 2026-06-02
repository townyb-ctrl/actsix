-- Include actor details in project task notifications and notify on reopen.

create or replace function public.actsix_notify_project_task_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  actor_person_id uuid;
  actor_name text;
  target_project_id uuid;
begin
  target_project_id := case
    when tg_op = 'INSERT' then new.project_id
    else coalesce(new.project_id, old.project_id)
  end;

  if target_project_id is null then
    return new;
  end if;

  select id, display_name
  into actor_person_id, actor_name
  from public.people
  where auth_user_id = auth.uid()
  limit 1;

  actor_name := coalesce(actor_name, 'Someone');

  select name
  into project_name
  from public.projects
  where id = target_project_id;

  if tg_op = 'INSERT' then
    perform public.actsix_notify_project_participants(
      target_project_id,
      actor_person_id,
      'Task added to project',
      actor_name || ' added ' || coalesce(new.title, 'a project task') || ' to ' || coalesce(project_name, 'a project') || '.',
      'project_task'
    );
  elsif tg_op = 'UPDATE' then
    if new.assigned_person_id is not null
      and new.assigned_person_id is distinct from old.assigned_person_id then
      perform public.actsix_create_notification_for_person(
        new.assigned_person_id,
        actor_person_id,
        'A task was assigned to you',
        actor_name || ' assigned ' || coalesce(new.title, 'a project task') || ' to you in ' || coalesce(project_name, 'a project') || '.',
        'task',
        'project',
        target_project_id::text
      );
    end if;

    if new.complete = true and old.complete is distinct from true then
      perform public.actsix_notify_project_participants(
        target_project_id,
        actor_person_id,
        'Project task completed',
        actor_name || ' marked ' || coalesce(new.title, 'a project task') || ' complete in ' || coalesce(project_name, 'a project') || '.',
        'project_task'
      );
    elsif new.complete = false and old.complete = true then
      perform public.actsix_notify_project_participants(
        target_project_id,
        actor_person_id,
        'Project task reopened',
        actor_name || ' reopened ' || coalesce(new.title, 'a project task') || ' in ' || coalesce(project_name, 'a project') || '.',
        'project_task'
      );
    end if;
  end if;

  return new;
end;
$$;
