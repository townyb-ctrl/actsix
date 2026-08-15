import { supabase } from "@/integrations/supabase/client";

/**
 * Turn the hirer's link on, minting a token the first time.
 *
 * The existing token is kept when one is already there, so turning the link off
 * and on again does not silently break a URL somebody has already been sent.
 * Issuing a fresh one is a separate, deliberate act.
 */
export const enableHirePortal = async (hireId: string) => {
  const { data: existing, error: readError } = await (supabase as any)
    .from("venue_hires")
    .select("portal_token")
    .eq("id", hireId)
    .maybeSingle();

  if (readError) return { error: readError };

  let token = existing?.portal_token as string | null;

  if (!token) {
    const { data, error } = await (supabase as any).rpc("new_venue_portal_token");
    if (error) return { error };
    token = data as string;
  }

  return (supabase as any)
    .from("venue_hires")
    .update({ portal_token: token, portal_enabled: true, updated_at: new Date().toISOString() })
    .eq("id", hireId);
};

/**
 * Turn the link off without discarding the token, so it can be turned back on
 * with the same URL. A hire that should never be reachable again gets a new
 * token instead.
 */
export const disableHirePortal = (hireId: string) =>
  (supabase as any)
    .from("venue_hires")
    .update({ portal_enabled: false, updated_at: new Date().toISOString() })
    .eq("id", hireId);
