import { supabase } from "@/integrations/supabase/client";

type CreateNotificationInput = {
  recipientUserId: string;
  actorPersonId?: string | null;
  title: string;
  message?: string | null;
  type?: string;
  entityType?: string | null;
  entityId?: string | null;
};

export const createNotification = async ({
  recipientUserId,
  actorPersonId = null,
  title,
  message = null,
  type = "system",
  entityType = null,
  entityId = null,
}: CreateNotificationInput) => {
  const { error } = await (supabase as any).from("notifications").insert({
    user_id: recipientUserId,
    actor_person_id: actorPersonId,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId,
  });

  if (error) {
    console.error("Notification error:", error.message);
    return { error };
  }

  return { error: null };
};

export const createNotificationForPerson = async ({
  personId,
  currentUserId,
  actorPersonId = null,
  title,
  message = null,
  type = "system",
  entityType = null,
  entityId = null,
}: {
  personId: string;
  currentUserId: string;
  actorPersonId?: string | null;
  title: string;
  message?: string | null;
  type?: string;
  entityType?: string | null;
  entityId?: string | null;
}) => {
  const { data: person, error: personError } = await (supabase as any)
    .from("people")
    .select("id, auth_user_id")
    .eq("id", personId)
    .maybeSingle();

  if (personError) {
    console.error("Notification person lookup error:", personError.message);
    return { error: personError };
  }

  if (!person?.auth_user_id) {
    return { error: null };
  }

  // Avoid notifying yourself for your own action.
  if (person.auth_user_id === currentUserId) {
    return { error: null };
  }

  return createNotification({
    recipientUserId: person.auth_user_id,
    actorPersonId,
    title,
    message,
    type,
    entityType,
    entityId,
  });
};
