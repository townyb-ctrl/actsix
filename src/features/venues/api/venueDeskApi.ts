import { supabase } from "@/integrations/supabase/client";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

/**
 * The desk reads across every hire at once, so these fetch by workspace rather
 * than hire by hire. Doing it the other way round means one request per hire
 * on the module's front page, which is the slowest screen in the product
 * arriving first.
 *
 * Assignments are the exception: they hang off positions, not off a workspace
 * column, so they come back by the position ids the first query returned.
 */
export const getWorkspacePositions = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_positions")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID);

export const getAssignmentsForPositions = (positionIds: string[]) =>
  (supabase as any).from("venue_position_assignments").select("*").in("position_id", positionIds);

export const getWorkspaceTurnaroundTasks = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_turnaround_tasks")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID);

export const getWorkspaceHireContacts = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_hire_contacts")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID);
