import { supabase } from "@/integrations/supabase/client";

import type {
  VenueIncidentCategory,
  VenueIncidentSeverity,
} from "@/features/venues/lib/venueSafety";

export type VenueSafetyFields = {
  security_required: boolean;
  security_provider: string;
  security_from: string | null;
  security_to: string | null;
  car_guards_required: boolean;
  car_guard_count: number;
  access_plan: string;
};

export const saveHireSafety = (hireId: string, fields: Partial<VenueSafetyFields>) =>
  (supabase as any)
    .from("venue_hires")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", hireId);

export const getIncidents = (hireId: string) =>
  (supabase as any)
    .from("venue_incidents")
    .select("*")
    .eq("hire_id", hireId)
    .order("occurred_at", { ascending: false });

export type VenueIncidentPayload = {
  space_id?: string | null;
  occurred_at?: string;
  severity?: VenueIncidentSeverity;
  category?: VenueIncidentCategory;
  summary?: string;
  action_taken?: string;
  reported_by?: string;
};

export const upsertIncident = ({
  incidentId,
  workspaceId,
  hireId,
  userId,
  payload,
}: {
  incidentId?: string;
  workspaceId: string;
  hireId: string;
  userId: string;
  payload: VenueIncidentPayload;
}) => {
  const table = (supabase as any).from("venue_incidents");

  if (incidentId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", incidentId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    hire_id: hireId,
    user_id: userId,
  });
};

/** Closing an incident stamps when; reopening clears it rather than leaving a stale date. */
export const setIncidentResolved = (incidentId: string, resolved: boolean) =>
  (supabase as any)
    .from("venue_incidents")
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId);

export const deleteIncident = (incidentId: string) =>
  (supabase as any).from("venue_incidents").delete().eq("id", incidentId);

export const getHireContacts = (hireId: string) =>
  (supabase as any)
    .from("venue_hire_contacts")
    .select("*")
    .eq("hire_id", hireId)
    .order("sort_order", { ascending: true });

export type VenueHireContactPayload = {
  service_contact_id?: string | null;
  name?: string;
  role?: string;
  phone?: string;
  notes?: string;
  sort_order?: number;
};

export const upsertHireContact = ({
  contactId,
  workspaceId,
  hireId,
  userId,
  payload,
}: {
  contactId?: string;
  workspaceId: string;
  hireId: string;
  userId: string;
  payload: VenueHireContactPayload;
}) => {
  const table = (supabase as any).from("venue_hire_contacts");

  if (contactId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", contactId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    hire_id: hireId,
    user_id: userId,
  });
};

export const deleteHireContact = (contactId: string) =>
  (supabase as any).from("venue_hire_contacts").delete().eq("id", contactId);
