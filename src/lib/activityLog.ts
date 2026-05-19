import { supabase } from "@/integrations/supabase/client";

type LogActivityInput = {
  userId: string;
  actorPersonId?: string | null;
  entityType: "project" | "service" | "task" | "people_group" | string;
  entityId: string;
  actionType: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export const logActivity = async ({
  userId,
  actorPersonId = null,
  entityType,
  entityId,
  actionType,
  title,
  description = null,
  metadata = {},
}: LogActivityInput) => {
  const { data, error } = await (supabase as any)
    .from("activity_logs")
    .insert({
      user_id: userId,
      actor_person_id: actorPersonId,
      entity_type: entityType,
      entity_id: entityId,
      action_type: actionType,
      title,
      description,
      metadata,
    })
    .select("id, actor_person_id, entity_type, entity_id, action_type, title, description, metadata, created_at")
    .single();

  if (error) {
    console.error("Activity log error:", error.message);
    return { data: null, error };
  }

  return { data, error: null };
};
