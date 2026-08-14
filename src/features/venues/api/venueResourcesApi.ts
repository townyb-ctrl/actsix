import { supabase } from "@/integrations/supabase/client";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export type VenueResourcePayload = {
  name?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  is_included?: boolean;
  unit_price?: number;
  notes?: string;
  is_active?: boolean;
};

export const getVenueResources = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_resources")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("name", { ascending: true });

export const upsertVenueResource = ({
  resourceId,
  workspaceId,
  userId,
  payload,
}: {
  resourceId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueResourcePayload;
}) => {
  const table = (supabase as any).from("venue_resources");

  if (resourceId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", resourceId);
  }

  return table.insert({ ...payload, workspace_id: workspaceId, user_id: userId });
};

/** Resources are deactivated, never deleted - a past hire's checklist still names them. */
export const setVenueResourceActive = (resourceId: string, isActive: boolean) =>
  (supabase as any)
    .from("venue_resources")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", resourceId);

export const getVenueSpaceResources = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_space_resources")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID);

/**
 * Upserting on the (space, resource) unique index means re-linking a resource
 * already attached to the space updates its quantity instead of failing.
 */
export const setSpaceResource = ({
  workspaceId,
  spaceId,
  resourceId,
  quantity,
}: {
  workspaceId: string;
  spaceId: string;
  resourceId: string;
  quantity: number;
}) =>
  (supabase as any).from("venue_space_resources").upsert(
    {
      workspace_id: workspaceId,
      space_id: spaceId,
      resource_id: resourceId,
      quantity,
    },
    { onConflict: "space_id,resource_id" }
  );

export const removeSpaceResource = ({
  spaceId,
  resourceId,
}: {
  spaceId: string;
  resourceId: string;
}) =>
  (supabase as any)
    .from("venue_space_resources")
    .delete()
    .eq("space_id", spaceId)
    .eq("resource_id", resourceId);
