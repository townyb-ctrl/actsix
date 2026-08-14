import { supabase } from "@/integrations/supabase/client";

import type {
  VenueEnquiryStatus,
  VenueInsuranceStatus,
  VenueRiskLevel,
} from "@/features/venues/lib/venueEnquiries";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export type VenueEnquiryPayload = {
  event_name?: string;
  event_type?: string;
  organisation?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  is_for_profit?: boolean;
  is_ticketed?: boolean;
  expected_attendance?: number | null;
  preferred_start?: string | null;
  preferred_end?: string | null;
  alternate_dates?: string;
  setup_notes?: string;
  space_ids?: string[];
  description?: string;
  av_needs?: string;
  catering_plan?: string;
  insurance_status?: VenueInsuranceStatus;
  heard_about?: string;
  status?: VenueEnquiryStatus;
};

export type VenueVettingPayload = {
  vetting_values_aligned?: boolean | null;
  vetting_has_restricted_content?: boolean | null;
  vetting_can_deliver?: boolean | null;
  vetting_damage_risk?: VenueRiskLevel;
  vetting_reputational_risk?: VenueRiskLevel;
  vetting_notes?: string;
};

export const getVenueEnquiries = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_enquiries")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("created_at", { ascending: false });

export const getVenueEnquiry = (enquiryId: string) =>
  (supabase as any).from("venue_enquiries").select("*").eq("id", enquiryId).maybeSingle();

/** Staff-raised enquiries only - public ones arrive through the submit_venue_enquiry RPC. */
export const upsertVenueEnquiry = ({
  enquiryId,
  workspaceId,
  userId,
  payload,
}: {
  enquiryId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueEnquiryPayload;
}) => {
  const table = (supabase as any).from("venue_enquiries");

  if (enquiryId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", enquiryId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    user_id: userId,
    source: "staff",
  });
};

export const updateVenueEnquiryVetting = (enquiryId: string, payload: VenueVettingPayload) =>
  (supabase as any)
    .from("venue_enquiries")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", enquiryId);

/**
 * A decline or a request for more information carries its reply text, so the
 * coordinator can see what was said without hunting through their sent mail.
 * Nothing is sent from here - ACTSIX has no outbound email yet.
 */
export const setVenueEnquiryStatus = ({
  enquiryId,
  status,
  reply,
}: {
  enquiryId: string;
  status: VenueEnquiryStatus;
  reply?: string;
}) =>
  (supabase as any)
    .from("venue_enquiries")
    .update({
      status,
      ...(reply === undefined ? {} : { decline_reason: reply }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", enquiryId);

/** Links an accepted enquiry to the booking it became. */
export const linkEnquiryToBooking = (enquiryId: string, bookingId: string) =>
  (supabase as any)
    .from("venue_enquiries")
    .update({
      status: "Accepted",
      converted_booking_id: bookingId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enquiryId);

export const deleteVenueEnquiry = (enquiryId: string) =>
  (supabase as any).from("venue_enquiries").delete().eq("id", enquiryId);

export const getVenueReplyTemplates = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_reply_templates")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("name", { ascending: true });

export const upsertVenueReplyTemplate = ({
  templateId,
  workspaceId,
  userId,
  payload,
}: {
  templateId?: string;
  workspaceId: string;
  userId: string;
  payload: { name?: string; kind?: "Decline" | "More info"; body?: string };
}) => {
  const table = (supabase as any).from("venue_reply_templates");

  if (templateId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", templateId);
  }

  return table.insert({ ...payload, workspace_id: workspaceId, user_id: userId });
};

export const deleteVenueReplyTemplate = (templateId: string) =>
  (supabase as any).from("venue_reply_templates").delete().eq("id", templateId);
