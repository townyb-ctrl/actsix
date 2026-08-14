export type VenueEnquiryStatus = "New" | "In review" | "Awaiting info" | "Accepted" | "Declined";
export type VenueEnquirySource = "public" | "staff";
export type VenueInsuranceStatus = "Unknown" | "Has cover" | "Needs cover";
/** "" means the coordinator has not rated it yet. */
export type VenueRiskLevel = "" | "Low" | "Medium" | "High";

export type VenueEnquiry = {
  id: string;
  workspace_id: string;
  user_id: string;
  event_name: string;
  event_type: string;
  organisation: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  is_for_profit: boolean;
  is_ticketed: boolean;
  expected_attendance: number | null;
  preferred_start: string | null;
  preferred_end: string | null;
  alternate_dates: string;
  setup_notes: string;
  space_ids: string[];
  description: string;
  av_needs: string;
  catering_plan: string;
  insurance_status: VenueInsuranceStatus;
  heard_about: string;
  status: VenueEnquiryStatus;
  source: VenueEnquirySource;
  /** Null on every vetting field means "not assessed", which is not the same as a no. */
  vetting_values_aligned: boolean | null;
  vetting_has_restricted_content: boolean | null;
  vetting_can_deliver: boolean | null;
  vetting_damage_risk: VenueRiskLevel;
  vetting_reputational_risk: VenueRiskLevel;
  vetting_notes: string;
  decline_reason: string;
  converted_booking_id: string | null;
  created_at: string;
  updated_at: string;
};

export const VENUE_ENQUIRY_STATUSES: VenueEnquiryStatus[] = [
  "New",
  "In review",
  "Awaiting info",
  "Accepted",
  "Declined",
];

export const VENUE_RISK_LEVELS: Exclude<VenueRiskLevel, "">[] = ["Low", "Medium", "High"];

export type VettingProgress = {
  completed: number;
  total: number;
  isComplete: boolean;
};

/**
 * How much of the vetting checklist has been answered. A considered "no" counts
 * as answered - only an untouched field (null, or an unrated risk level) is
 * outstanding, so the coordinator can see at a glance whether a decision was
 * actually made or simply skipped.
 */
export const vettingProgress = (enquiry: VenueEnquiry): VettingProgress => {
  const answers = [
    enquiry.vetting_values_aligned !== null,
    enquiry.vetting_has_restricted_content !== null,
    enquiry.vetting_can_deliver !== null,
    enquiry.vetting_damage_risk !== "",
    enquiry.vetting_reputational_risk !== "",
  ];

  const completed = answers.filter(Boolean).length;

  return { completed, total: answers.length, isComplete: completed === answers.length };
};

/**
 * Names for the spaces an enquirer asked about, in catalogue order rather than
 * the order they happened to tick. A space deleted since the enquiry arrived is
 * dropped rather than rendered as a blank.
 */
export const spaceNamesForEnquiry = (
  enquiry: VenueEnquiry,
  spaces: { id: string; name: string }[]
): string[] =>
  spaces.filter((space) => enquiry.space_ids.includes(space.id)).map((space) => space.name);
