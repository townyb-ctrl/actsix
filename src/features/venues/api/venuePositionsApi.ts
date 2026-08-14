import { supabase } from "@/integrations/supabase/client";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export type VenuePositionRolePayload = {
  name?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
};

export type VenuePositionPayload = {
  role_id?: string;
  starts_at?: string;
  ends_at?: string;
  needed?: number;
  notes?: string;
};

export const getPositionRoles = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_position_roles")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

export const upsertPositionRole = ({
  roleId,
  workspaceId,
  userId,
  payload,
}: {
  roleId?: string;
  workspaceId: string;
  userId: string;
  payload: VenuePositionRolePayload;
}) => {
  const table = (supabase as any).from("venue_position_roles");

  if (roleId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", roleId);
  }

  return table.insert({ ...payload, workspace_id: workspaceId, user_id: userId });
};

export const getPositions = (hireId: string) =>
  (supabase as any)
    .from("venue_positions")
    .select("*")
    .eq("hire_id", hireId)
    .order("starts_at", { ascending: true });

export const upsertPosition = ({
  positionId,
  workspaceId,
  hireId,
  userId,
  payload,
}: {
  positionId?: string;
  workspaceId: string;
  hireId: string;
  userId: string;
  payload: VenuePositionPayload;
}) => {
  const table = (supabase as any).from("venue_positions");

  if (positionId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", positionId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    hire_id: hireId,
    user_id: userId,
  });
};

export const deletePosition = (positionId: string) =>
  (supabase as any).from("venue_positions").delete().eq("id", positionId);

/** Assignments for every position on one hire, in one read. */
export const getPositionAssignments = (positionIds: string[]) =>
  (supabase as any)
    .from("venue_position_assignments")
    .select("*")
    .in("position_id", positionIds.length > 0 ? positionIds : [EMPTY_WORKSPACE_ID]);

/**
 * Puts someone into a slot. A directory person carries `personId`; anyone else
 * is named by hand, which is how a freelancer or a hirer's own helper gets onto
 * the board without being added to the church directory first.
 */
export const assignPosition = ({
  workspaceId,
  positionId,
  userId,
  personId,
  displayName,
  notes,
}: {
  workspaceId: string;
  positionId: string;
  userId: string;
  personId?: string | null;
  displayName?: string;
  notes?: string;
}) =>
  (supabase as any).from("venue_position_assignments").insert({
    workspace_id: workspaceId,
    position_id: positionId,
    user_id: userId,
    person_id: personId ?? null,
    display_name: displayName ?? "",
    notes: notes ?? "",
  });

export const unassignPosition = (assignmentId: string) =>
  (supabase as any).from("venue_position_assignments").delete().eq("id", assignmentId);
