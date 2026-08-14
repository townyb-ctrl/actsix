import { supabase } from "@/integrations/supabase/client";

import type {
  VenueTurnaroundKind,
  VenueWalkthroughPhase,
} from "@/features/venues/lib/venueTurnaround";

export type VenueTurnaroundTaskPayload = {
  space_id?: string | null;
  title?: string;
  kind?: VenueTurnaroundKind;
  notes?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_order?: number;
};

export const getTurnaroundTasks = (hireId: string) =>
  (supabase as any)
    .from("venue_turnaround_tasks")
    .select("*")
    .eq("hire_id", hireId)
    .order("sort_order", { ascending: true });

export const upsertTurnaroundTask = ({
  taskId,
  workspaceId,
  hireId,
  userId,
  payload,
}: {
  taskId?: string;
  workspaceId: string;
  hireId: string;
  userId: string;
  payload: VenueTurnaroundTaskPayload;
}) => {
  const table = (supabase as any).from("venue_turnaround_tasks");

  if (taskId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", taskId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    hire_id: hireId,
    user_id: userId,
  });
};

/**
 * Ticking a task records who and when; un-ticking clears both, so a mistaken
 * tick leaves no misleading trace of work nobody did.
 */
export const setTurnaroundTaskDone = ({
  taskId,
  done,
  doneBy,
}: {
  taskId: string;
  done: boolean;
  doneBy: string;
}) =>
  (supabase as any)
    .from("venue_turnaround_tasks")
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? doneBy : "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

export const deleteTurnaroundTask = (taskId: string) =>
  (supabase as any).from("venue_turnaround_tasks").delete().eq("id", taskId);

export const getWalkthroughs = (hireId: string) =>
  (supabase as any)
    .from("venue_walkthroughs")
    .select("*")
    .eq("hire_id", hireId)
    .order("walked_at", { ascending: true });

export type VenueWalkthroughPayload = {
  space_id?: string | null;
  phase?: VenueWalkthroughPhase;
  condition_notes?: string;
  photo_urls?: string[];
  walked_by?: string;
};

export const upsertWalkthrough = ({
  walkthroughId,
  workspaceId,
  hireId,
  userId,
  payload,
}: {
  walkthroughId?: string;
  workspaceId: string;
  hireId: string;
  userId: string;
  payload: VenueWalkthroughPayload;
}) => {
  const table = (supabase as any).from("venue_walkthroughs");

  if (walkthroughId) {
    return table
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", walkthroughId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    hire_id: hireId,
    user_id: userId,
  });
};

export const deleteWalkthrough = (walkthroughId: string) =>
  (supabase as any).from("venue_walkthroughs").delete().eq("id", walkthroughId);
