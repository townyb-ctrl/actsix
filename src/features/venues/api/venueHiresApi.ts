import { supabase } from "@/integrations/supabase/client";

import type { VenueHireStatus } from "@/features/venues/lib/venueHires";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export type VenueHirePayload = {
  name?: string;
  event_type?: string;
  hirer_contact_id?: string | null;
  hirer_name?: string;
  hirer_email?: string;
  hirer_phone?: string;
  onsite_contact_name?: string;
  onsite_contact_phone?: string;
  status?: VenueHireStatus;
  payment_terms?: string;
  enquiry_id?: string | null;
  notes?: string;
};

export const getVenueHires = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_hires")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("created_at", { ascending: false });

export const getVenueHire = (hireId: string) =>
  (supabase as any).from("venue_hires").select("*").eq("id", hireId).maybeSingle();

/** Every booking attached to one hire, earliest first. */
export const getBookingsForHire = (hireId: string) =>
  (supabase as any)
    .from("venue_bookings")
    .select("*")
    .eq("hire_id", hireId)
    .order("starts_at", { ascending: true });

export const upsertVenueHire = ({
  hireId,
  workspaceId,
  userId,
  payload,
}: {
  hireId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueHirePayload;
}) => {
  const table = (supabase as any).from("venue_hires");

  // Returns the row either way so a caller creating a hire has an id to attach
  // its first booking to.
  if (hireId) {
    return table
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", hireId)
      .select("id")
      .single();
  }

  return table
    .insert({ ...payload, workspace_id: workspaceId, user_id: userId })
    .select("id")
    .single();
};

export const updateVenueHireStatus = (hireId: string, status: VenueHireStatus) =>
  (supabase as any)
    .from("venue_hires")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", hireId);

/**
 * Deleting a hire releases its bookings rather than removing them - the
 * `on delete set null` on venue_bookings.hire_id does that in the database.
 * A booked space is still booked whether or not the paperwork survives.
 */
export const deleteVenueHire = (hireId: string) =>
  (supabase as any).from("venue_hires").delete().eq("id", hireId);

/** Moves an existing standalone booking under a hire, or releases it again. */
export const setBookingHire = (bookingId: string, hireId: string | null) =>
  (supabase as any)
    .from("venue_bookings")
    .update({ hire_id: hireId, updated_at: new Date().toISOString() })
    .eq("id", bookingId);
