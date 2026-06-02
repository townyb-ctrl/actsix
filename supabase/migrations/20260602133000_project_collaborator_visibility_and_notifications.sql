-- Make collaborator visibility and project notifications reliable at the database layer.

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_collaborators'
      and policyname = 'Project collaborators can read collaborator list'
  ) then
    create policy "Project collaborators can read collaborator list"
      on public.project_collaborators
      for select
      to authenticated
      using (public.can_access_project(project_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'people'
      and policyname = 'Project collaborators can read project people'
  ) then
    create policy "Project collaborators can read project people"
      on public.people
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.project_collaborators pc
          where pc.person_id = people.id
            and public.can_access_project(pc.project_id)
        )
      );
  end if;
end $$;

create or replace function public.actsix_notify_project_participants(
  target_project_id uuid,
  actor_person_id uuid,
  notification_title text,
  notification_message text,
  notification_type text default 'project_task'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  project_owner_user_id uuid;
  recipient_user_id uuid;
begin
  select user_id
  into project_owner_user_id
  from public.projects
  where id = target_project_id;

  if project_owner_user_id is not null and project_owner_user_id <> auth.uid() then
    perform public.actsix_create_notification_for_user(
      project_owner_user_id,
      actor_person_id,
      notification_title,
      notification_message,
      notification_type,
      'project',
      target_project_id::text
    );
  end if;

  for recipient_user_id in
    select distinct pe.auth_user_id
    from public.project_collaborators pc
    join public.people pe on pe.id = pc.person_id
    where pc.project_id = target_project_id
      and pe.auth_user_id is not null
      and pe.auth_user_id <> auth.uid()
      and (actor_person_id is null or pe.id <> actor_person_id)
  loop
    perform public.actsix_create_notification_for_user(
      recipient_user_id,
      actor_person_id,
      notification_title,
      notification_message,
      notification_type,
      'project',
      target_project_id::text
    );
  end loop;
end;
$$;

create or replace function public.actsix_notify_project_collaborator_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
begin
  select name into project_name from public.projects where id = new.project_id;

  perform public.actsix_create_notification_for_person(
    new.person_id,
    null,
    'You were added to a project',
    'You were added to ' || coalesce(project_name, 'a project') || ' as ' || coalesce(new.role, 'Collaborator') || '.',
    'project',
    'project',
    new.project_id::text
  );

  return new;
end;
$$;

drop trigger if exists actsix_project_collaborator_added_notification on public.project_collaborators;
create trigger actsix_project_collaborator_added_notification
after insert on public.project_collaborators
for each row
execute function public.actsix_notify_project_collaborator_added();

create or replace function public.actsix_notify_project_task_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  actor_person_id uuid;
  target_project_id uuid;
begin
  target_project_id := case
    when tg_op = 'INSERT' then new.project_id
    else coalesce(new.project_id, old.project_id)
  end;

  if target_project_id is null then
    return new;
  end if;

  select id
  into actor_person_id
  from public.people
  where auth_user_id = auth.uid()
  limit 1;

  select name
  into project_name
  from public.projects
  where id = target_project_id;

  if tg_op = 'INSERT' then
    perform public.actsix_notify_project_participants(
      target_project_id,
      actor_person_id,
      'Task added to project',
      coalesce(new.title, 'A project task') || ' was added to ' || coalesce(project_name, 'a project') || '.',
      'project_task'
    );
  elsif tg_op = 'UPDATE' then
    if new.assigned_person_id is not null
      and new.assigned_person_id is distinct from old.assigned_person_id then
      perform public.actsix_create_notification_for_person(
        new.assigned_person_id,
        actor_person_id,
        'A task was assigned to you',
        coalesce(new.title, 'A project task') || ' was assigned to you in ' || coalesce(project_name, 'a project') || '.',
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
        coalesce(new.title, 'A project task') || ' was completed in ' || coalesce(project_name, 'a project') || '.',
        'project_task'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists actsix_project_task_insert_notification on public.tasks;
create trigger actsix_project_task_insert_notification
after insert on public.tasks
for each row
when (new.project_id is not null)
execute function public.actsix_notify_project_task_changed();

drop trigger if exists actsix_project_task_update_notification on public.tasks;
create trigger actsix_project_task_update_notification
after update on public.tasks
for each row
when (new.project_id is not null)
execute function public.actsix_notify_project_task_changed();
