import { supabase } from "@/integrations/supabase/client";

import type {
  VenueBookingStatus,
  VenueBookingType,
  VenuePaymentStatus,
} from "@/features/venues/lib/venueBookings";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export type VenueSpacePayload = {
  name?: string;
  description?: string;
  capacity?: number | null;
  hourly_rate?: number;
  daily_rate?: number;
  color?: string;
  is_active?: boolean;
};

export type VenueBookingPayload = {
  space_id: string;
  title: string;
  booking_type: VenueBookingType;
  hirer_contact_id?: string | null;
  hirer_name?: string;
  hirer_email?: string;
  hirer_phone?: string;
  starts_at: string;
  ends_at: string;
  status: VenueBookingStatus;
  quoted_fee?: number;
  deposit_amount?: number;
  payment_status?: VenuePaymentStatus;
  notes?: string;
};

export const getVenueSpaces = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_spaces")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("name", { ascending: true });

export const upsertVenueSpace = ({
  spaceId,
  workspaceId,
  userId,
  payload,
}: {
  spaceId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueSpacePayload;
}) => {
  const table = (supabase as any).from("venue_spaces");

  if (spaceId) return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", spaceId);

  return table.insert({ ...payload, workspace_id: workspaceId, user_id: userId });
};

export const setVenueSpaceActive = (spaceId: string, isActive: boolean) =>
  (supabase as any)
    .from("venue_spaces")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", spaceId);

export const getVenueBookings = ({
  workspaceId,
  fromIso,
  toIso,
}: {
  workspaceId?: string | null;
  fromIso?: string;
  toIso?: string;
}) => {
  let query = (supabase as any)
    .from("venue_bookings")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("starts_at", { ascending: true });

  if (fromIso) query = query.gte("starts_at", fromIso);
  if (toIso) query = query.lte("starts_at", toIso);

  return query;
};

/**
 * Money only ever lands on an external booking - an internal one is stored
 * with zeroed fees so a booking that switches type never leaves a stale price
 * behind.
 */
export const upsertVenueBooking = ({
  bookingId,
  workspaceId,
  userId,
  payload,
}: {
  bookingId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueBookingPayload;
}) => {
  const isExternal = payload.booking_type === "external";

  const row = {
    space_id: payload.space_id,
    title: payload.title,
    booking_type: payload.booking_type,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    status: payload.status,
    notes: payload.notes ?? "",
    hirer_contact_id: isExternal ? payload.hirer_contact_id ?? null : null,
    hirer_name: isExternal ? payload.hirer_name ?? "" : "",
    hirer_email: isExternal ? payload.hirer_email ?? "" : "",
    hirer_phone: isExternal ? payload.hirer_phone ?? "" : "",
    quoted_fee: isExternal ? payload.quoted_fee ?? 0 : 0,
    deposit_amount: isExternal ? payload.deposit_amount ?? 0 : 0,
    payment_status: isExternal ? payload.payment_status ?? "Unpaid" : "Not applicable",
  };

  const table = (supabase as any).from("venue_bookings");

  if (bookingId) return table.update({ ...row, updated_at: new Date().toISOString() }).eq("id", bookingId);

  return table.insert({ ...row, workspace_id: workspaceId, user_id: userId });
};

export const updateVenueBookingStatus = (bookingId: string, status: VenueBookingStatus) =>
  (supabase as any)
    .from("venue_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId);

export const deleteVenueBooking = (bookingId: string) =>
  (supabase as any).from("venue_bookings").delete().eq("id", bookingId);

export const getVenueRequestToken = (workspaceId: string) =>
  (supabase as any)
    .from("workspaces")
    .select("venue_request_token")
    .eq("id", workspaceId)
    .maybeSingle();

/**
 * `.select("id")` matters here: without it, PostgREST returns
 * `{ data: null, error: null }` when RLS filters the UPDATE to zero rows -
 * indistinguishable from success unless the caller checks the returned row.
 */
export const setVenueRequestToken = (workspaceId: string, token: string | null) =>
  (supabase as any)
    .from("workspaces")
    .update({ venue_request_token: token })
    .eq("id", workspaceId)
    .select("id");

/** Promotes an approved public request's raw hirer details into the shared contact book. */
export const createHirerContact = ({
  workspaceId,
  userId,
  name,
  email,
  phone,
}: {
  workspaceId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
}) =>
  (supabase as any)
    .from("service_contacts")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      name,
      email,
      phone,
      category: "Hirer",
    })
    .select("id")
    .single();
