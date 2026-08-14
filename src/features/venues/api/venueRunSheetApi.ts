import { supabase } from "@/integrations/supabase/client";

export type VenueRunSheetItemPayload = {
  space_id?: string | null;
  title?: string;
  starts_at?: string;
  ends_at?: string;
  setup_notes?: string;
  av_notes?: string;
  access_notes?: string;
  risk_notes?: string;
  sort_order?: number;
};

export const getRunSheetItems = (hireId: string) =>
  (supabase as any)
    .from("venue_run_sheet_items")
    .select("*")
    .eq("hire_id", hireId)
    .order("starts_at", { ascending: true })
    .order("sort_order", { ascending: true });

export const upsertRunSheetItem = ({
  itemId,
  workspaceId,
  hireId,
  userId,
  payload,
}: {
  itemId?: string;
  workspaceId: string;
  hireId: string;
  userId: string;
  payload: VenueRunSheetItemPayload;
}) => {
  const table = (supabase as any).from("venue_run_sheet_items");

  if (itemId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", itemId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    hire_id: hireId,
    user_id: userId,
  });
};

export const deleteRunSheetItem = (itemId: string) =>
  (supabase as any).from("venue_run_sheet_items").delete().eq("id", itemId);

/**
 * What to do differently next time. Kept on the hire rather than in a debrief
 * form of its own, so a repeat hire cloned from this one carries it forward
 * instead of the lesson being relearned.
 */
export const setHireLessons = (hireId: string, lessons: string) =>
  (supabase as any)
    .from("venue_hires")
    .update({ lessons_learned: lessons, updated_at: new Date().toISOString() })
    .eq("id", hireId);
