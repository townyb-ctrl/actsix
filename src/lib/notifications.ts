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
  const { error } = await (supabase as any).rpc("actsix_create_notification_for_user", {
    recipient_user_id: recipientUserId,
    actor_person_id: actorPersonId,
    notification_title: title,
    notification_message: message,
    notification_type: type,
    notification_entity_type: entityType,
    notification_entity_id: entityId,
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
  if (!personId || !currentUserId) {
    return { error: null };
  }

  const { error } = await (supabase as any).rpc("actsix_create_notification_for_person", {
    recipient_person_id: personId,
    actor_person_id: actorPersonId,
    notification_title: title,
    notification_message: message,
    notification_type: type,
    notification_entity_type: entityType,
    notification_entity_id: entityId,
  });

  if (error) {
    console.error("Notification person RPC error:", error.message);
    return { error };
  }

  return { error: null };
};

export const notifyProjectParticipants = async ({
  projectId,
  currentUserId,
  actorPersonId = null,
  title,
  message = null,
  type = "project",
  entityType = "project",
  entityId = projectId,
  excludePersonIds = [],
}: {
  projectId: string;
  currentUserId: string;
  actorPersonId?: string | null;
  title: string;
  message?: string | null;
  type?: string;
  entityType?: string | null;
  entityId?: string | null;
  excludePersonIds?: Array<string | null | undefined>;
}) => {
  const excludedPeople = new Set(
    [actorPersonId, ...excludePersonIds].filter(Boolean) as string[]
  );

  const [
    { data: project, error: projectError },
    { data: collaborators, error: collaboratorError },
  ] = await Promise.all([
    (supabase as any)
      .from("projects")
      .select("id, name, user_id")
      .eq("id", projectId)
      .maybeSingle(),
    (supabase as any)
      .from("project_collaborators")
      .select("person_id, people(id, auth_user_id)")
      .eq("project_id", projectId),
  ]);

  if (projectError) {
    console.error("Notification project lookup error:", projectError.message);
    return { error: projectError };
  }

  if (collaboratorError) {
    console.error("Notification collaborators lookup error:", collaboratorError.message);
    return { error: collaboratorError };
  }

  const collaboratorPeople = (collaborators || [])
    .map((collaborator: any) => collaborator.people)
    .filter(Boolean);

  const notifications = collaboratorPeople
    .filter((person: any) => !excludedPeople.has(person.id))
    .map((person: any) =>
      createNotificationForPerson({
        personId: person.id,
        currentUserId,
        actorPersonId,
        title,
        message,
        type,
        entityType,
        entityId,
      })
    );

  const ownerAlreadyIncluded = collaboratorPeople.some(
    (person: any) => person.auth_user_id === project?.user_id
  );

  if (project?.user_id && project.user_id !== currentUserId && !ownerAlreadyIncluded) {
    notifications.push(
      createNotification({
        recipientUserId: project.user_id,
        actorPersonId,
        title,
        message,
        type,
        entityType,
        entityId,
      })
    );
  }

  await Promise.all(notifications);
  return { error: null };
};
