import { supabase } from "@/integrations/supabase/client";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Every quote line in the workspace. Reporting groups by hire, so the join is
 * done in the client against hires already loaded rather than by fetching the
 * lines hire by hire.
 */
export const getWorkspaceQuoteLines = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_quote_lines")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID);

export const getWorkspacePayments = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_payments")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID);
