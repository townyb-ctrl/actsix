import { supabase } from "@/integrations/supabase/client";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export const getVenueSigns = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_signs")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("name", { ascending: true });

export type VenueSignPayload = {
  name?: string;
  body?: string;
  placement?: string;
  exists_physically?: boolean;
  needs_reprint?: boolean;
  last_printed_on?: string | null;
  is_active?: boolean;
};

export const upsertVenueSign = ({
  signId,
  workspaceId,
  userId,
  payload,
}: {
  signId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueSignPayload;
}) => {
  const table = (supabase as any).from("venue_signs");

  if (signId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", signId);
  }

  return table.insert({ ...payload, workspace_id: workspaceId, user_id: userId });
};

export const deleteVenueSign = (signId: string) =>
  (supabase as any).from("venue_signs").delete().eq("id", signId);

export const getHireSigns = (hireId: string) =>
  (supabase as any).from("venue_hire_signs").select("*").eq("hire_id", hireId);

export const addHireSign = ({
  workspaceId,
  hireId,
  signId,
  userId,
}: {
  workspaceId: string;
  hireId: string;
  signId: string;
  userId: string;
}) =>
  (supabase as any)
    .from("venue_hire_signs")
    .insert({ workspace_id: workspaceId, hire_id: hireId, sign_id: signId, user_id: userId });

export const updateHireSign = (
  linkId: string,
  payload: { quantity?: number; placement?: string; prepared?: boolean }
) =>
  (supabase as any)
    .from("venue_hire_signs")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", linkId);

export const removeHireSign = (linkId: string) =>
  (supabase as any).from("venue_hire_signs").delete().eq("id", linkId);

export const getAvPresets = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_av_presets")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("name", { ascending: true });

export type VenueAvPresetPayload = {
  name?: string;
  event_type?: string;
  space_id?: string | null;
  routing?: string;
  changeover_steps?: string;
  is_active?: boolean;
};

export const upsertAvPreset = ({
  presetId,
  workspaceId,
  userId,
  payload,
}: {
  presetId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueAvPresetPayload;
}) => {
  const table = (supabase as any).from("venue_av_presets");

  if (presetId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", presetId);
  }

  return table.insert({ ...payload, workspace_id: workspaceId, user_id: userId });
};

export const deleteAvPreset = (presetId: string) =>
  (supabase as any).from("venue_av_presets").delete().eq("id", presetId);

export const setHireAvPreset = (hireId: string, presetId: string | null) =>
  (supabase as any)
    .from("venue_hires")
    .update({ av_preset_id: presetId, updated_at: new Date().toISOString() })
    .eq("id", hireId);

export const setHireWalkieChannels = (hireId: string, channels: string) =>
  (supabase as any)
    .from("venue_hires")
    .update({ walkie_channels: channels, updated_at: new Date().toISOString() })
    .eq("id", hireId);

export const getResourceCheckouts = (hireId: string) =>
  (supabase as any)
    .from("venue_resource_checkouts")
    .select("*")
    .eq("hire_id", hireId)
    .order("taken_at", { ascending: false });

export const checkOutResource = ({
  workspaceId,
  hireId,
  resourceId,
  userId,
  quantity,
  takenBy,
}: {
  workspaceId: string;
  hireId: string;
  resourceId: string;
  userId: string;
  quantity: number;
  takenBy: string;
}) =>
  (supabase as any).from("venue_resource_checkouts").insert({
    workspace_id: workspaceId,
    hire_id: hireId,
    resource_id: resourceId,
    user_id: userId,
    quantity,
    taken_by: takenBy,
  });

/**
 * Booking kit back in. The condition note is captured at return time because
 * that is the only moment anybody actually looks at the item.
 */
export const returnResource = (checkoutId: string, conditionNote: string) =>
  (supabase as any)
    .from("venue_resource_checkouts")
    .update({
      returned_at: new Date().toISOString(),
      condition_note: conditionNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", checkoutId);
