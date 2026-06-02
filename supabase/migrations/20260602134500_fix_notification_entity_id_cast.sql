-- notifications.entity_id is uuid in the live schema; cast RPC text inputs safely.

create or replace function public.actsix_create_notification_for_user(
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
    nullif(notification_entity_id, '')::uuid
  );
end;
$$;
