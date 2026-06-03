create or replace function public.actsix_notify_developer_on_workspace_join()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  developer_user_id uuid;
  joined_email text;
  joined_name text;
  joined_workspace_name text;
begin
  select id
  into developer_user_id
  from auth.users
  where lower(email) = 'brandon@swbc.co.za'
  limit 1;

  if developer_user_id is null or developer_user_id = new.auth_user_id then
    return new;
  end if;

  select email
  into joined_email
  from auth.users
  where id = new.auth_user_id
  limit 1;

  select display_name
  into joined_name
  from public.people
  where id = new.person_id
  limit 1;

  select name
  into joined_workspace_name
  from public.workspaces
  where id = new.workspace_id
  limit 1;

  insert into public.notifications (
    user_id,
    actor_person_id,
    title,
    message,
    type,
    entity_type,
    entity_id
  )
  values (
    developer_user_id,
    new.person_id,
    'Workspace member joined',
    concat(
      coalesce(nullif(joined_name, ''), joined_email, 'Someone'),
      ' joined ',
      coalesce(nullif(joined_workspace_name, ''), 'a workspace'),
      '.'
    ),
    'workspace',
    'workspace',
    new.workspace_id
  );

  return new;
end;
$$;

drop trigger if exists actsix_notify_developer_on_workspace_join_trigger
  on public.workspace_members;

create trigger actsix_notify_developer_on_workspace_join_trigger
after insert on public.workspace_members
for each row
execute function public.actsix_notify_developer_on_workspace_join();
