import type { VenueHire } from "@/features/venues/lib/venueHires";

export type VenueIncidentSeverity = "Minor" | "Serious" | "Critical";
export type VenueIncidentCategory =
  | "Injury"
  | "Damage"
  | "Security"
  | "Behaviour"
  | "Equipment"
  | "Other";

export type VenueIncident = {
  id: string;
  workspace_id: string;
  hire_id: string;
  user_id: string;
  space_id: string | null;
  occurred_at: string;
  severity: VenueIncidentSeverity;
  category: VenueIncidentCategory;
  summary: string;
  action_taken: string;
  reported_by: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VenueHireContact = {
  id: string;
  workspace_id: string;
  hire_id: string;
  user_id: string;
  service_contact_id: string | null;
  name: string;
  role: string;
  phone: string;
  notes: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const VENUE_INCIDENT_SEVERITIES: VenueIncidentSeverity[] = [
  "Minor",
  "Serious",
  "Critical",
];

export const VENUE_INCIDENT_CATEGORIES: VenueIncidentCategory[] = [
  "Injury",
  "Damage",
  "Security",
  "Behaviour",
  "Equipment",
  "Other",
];

const SEVERITY_ORDER: Record<VenueIncidentSeverity, number> = {
  Critical: 0,
  Serious: 1,
  Minor: 2,
};

/**
 * Open incidents first, worst first inside that, most recent first inside that.
 * The log exists to show what still needs attention, not to be a diary.
 */
export const sortIncidents = (incidents: VenueIncident[]): VenueIncident[] =>
  [...incidents].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;

    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;

    return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
  });

export type IncidentSummary = {
  total: number;
  open: number;
  /** Serious or Critical and still open - the ones somebody has to act on. */
  needsAttention: number;
};

export const incidentSummary = (incidents: VenueIncident[]): IncidentSummary => {
  const open = incidents.filter((incident) => !incident.resolved);

  return {
    total: incidents.length,
    open: open.length,
    needsAttention: open.filter((incident) => incident.severity !== "Minor").length,
  };
};

export type SafetyGap = string;

/**
 * What is still missing before the day.
 *
 * Only ever reports on things somebody has said they need: a hire with no
 * security required is not missing a security provider. Silence is not treated
 * as a gap, because inventing warnings trains people to ignore all of them.
 */
export const safetyGaps = (hire: VenueHire, contacts: VenueHireContact[]): SafetyGap[] => {
  const gaps: SafetyGap[] = [];

  if (hire.security_required && !hire.security_provider.trim()) {
    gaps.push("Security is required but no provider is named");
  }

  if (hire.security_required && (!hire.security_from || !hire.security_to)) {
    gaps.push("Security hours are not set");
  }

  if (hire.car_guards_required && hire.car_guard_count === 0) {
    gaps.push("Car guards are required but the number is zero");
  }

  if (contacts.length === 0) {
    gaps.push("Nobody is listed to call on the day");
  } else if (!contacts.some((contact) => contact.phone.trim())) {
    gaps.push("No contact on the list has a phone number");
  }

  return gaps;
};
