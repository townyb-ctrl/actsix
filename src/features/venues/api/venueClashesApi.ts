import { supabase } from "@/integrations/supabase/client";

/**
 * Church events that overlap the given window at all.
 *
 * Half-open on purpose, matching `findClashes`: an event ending exactly when
 * the window opens is not in the window. The range is filtered in the query
 * rather than the client so a workspace with years of diary history does not
 * ship all of it to the browser to check one weekend.
 */
export const getChurchEventsInRange = ({
  workspaceId,
  startsAt,
  endsAt,
}: {
  workspaceId: string;
  startsAt: string;
  endsAt: string;
}) =>
  (supabase as any)
    .from("calendar_events")
    .select("id, title, calendar_name, space_id, starts_at, ends_at, all_day, status")
    .eq("workspace_id", workspaceId)
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt)
    .order("starts_at", { ascending: true });
