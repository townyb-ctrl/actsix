-- Let app actions notify other authenticated users without exposing broad insert access.

create or replace function public.create_notification_for_user(
  recipient_user_id uuid,
  actor_person_id uuid,
  notification_title text,
  notification_message text default null,
  notification_type text default 'system',
  notification_entity_type text default null,
  notification_entity_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if recipient_user_id is null or recipient_user_id = auth.uid() then
    return;
  end if;

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
    recipient_user_id,
    actor_person_id,
    notification_title,
    notification_message,
    coalesce(notification_type, 'system'),
    notification_entity_type,
    notification_entity_id
  );
end;
$$;

create or replace function public.create_notification_for_person(
  recipient_person_id uuid,
  actor_person_id uuid,
  notification_title text,
  notification_message text default null,
  notification_type text default 'system',
  notification_entity_type text default null,
  notification_entity_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_user_id uuid;
begin
  select auth_user_id
  into recipient_user_id
  from public.people
  where id = recipient_person_id
  limit 1;

  perform public.create_notification_for_user(
    recipient_user_id,
    actor_person_id,
    notification_title,
    notification_message,
    notification_type,
    notification_entity_type,
    notification_entity_id
  );
end;
$$;

grant execute on function public.create_notification_for_user(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.create_notification_for_person(uuid, uuid, text, text, text, text, text) to authenticated;
