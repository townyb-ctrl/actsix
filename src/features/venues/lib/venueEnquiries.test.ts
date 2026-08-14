import { describe, expect, it } from "vitest";

import {
  spaceNamesForEnquiry,
  vettingProgress,
  type VenueEnquiry,
} from "./venueEnquiries";

const enquiry = (overrides: Partial<VenueEnquiry> = {}): VenueEnquiry => ({
  id: "enquiry-1",
  workspace_id: "workspace-1",
  user_id: "user-1",
  event_name: "Robertson wedding",
  event_type: "Wedding",
  organisation: "",
  contact_name: "Dana Robertson",
  contact_email: "dana@example.com",
  contact_phone: "",
  is_for_profit: false,
  is_ticketed: false,
  expected_attendance: null,
  preferred_start: null,
  preferred_end: null,
  alternate_dates: "",
  setup_notes: "",
  space_ids: [],
  description: "",
  av_needs: "",
  catering_plan: "",
  insurance_status: "Unknown",
  heard_about: "",
  status: "New",
  source: "public",
  vetting_values_aligned: null,
  vetting_has_restricted_content: null,
  vetting_can_deliver: null,
  vetting_damage_risk: "",
  vetting_reputational_risk: "",
  vetting_notes: "",
  decline_reason: "",
  converted_booking_id: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const fullyVetted: Partial<VenueEnquiry> = {
  vetting_values_aligned: true,
  vetting_has_restricted_content: false,
  vetting_can_deliver: true,
  vetting_damage_risk: "Low",
  vetting_reputational_risk: "Low",
};

describe("vettingProgress", () => {
  it("counts nothing on an untouched enquiry", () => {
    expect(vettingProgress(enquiry())).toEqual({ completed: 0, total: 5, isComplete: false });
  });

  it("counts a considered no the same as a yes", () => {
    const result = vettingProgress(enquiry({ vetting_values_aligned: false }));

    expect(result.completed).toBe(1);
    expect(result.isComplete).toBe(false);
  });

  it("is complete once every check has an answer", () => {
    expect(vettingProgress(enquiry(fullyVetted))).toEqual({
      completed: 5,
      total: 5,
      isComplete: true,
    });
  });

  it("treats an empty risk level as unanswered", () => {
    const result = vettingProgress(enquiry({ ...fullyVetted, vetting_damage_risk: "" }));

    expect(result.completed).toBe(4);
    expect(result.isComplete).toBe(false);
  });
});

describe("spaceNamesForEnquiry", () => {
  const spaces = [
    { id: "space-1", name: "Main Hall" },
    { id: "space-2", name: "Foyer" },
  ];

  it("resolves ids to names in the order the spaces are listed", () => {
    const result = spaceNamesForEnquiry(enquiry({ space_ids: ["space-2", "space-1"] }), spaces);

    expect(result).toEqual(["Main Hall", "Foyer"]);
  });

  it("ignores an id whose space has since been deleted", () => {
    expect(spaceNamesForEnquiry(enquiry({ space_ids: ["gone"] }), spaces)).toEqual([]);
  });

  it("returns nothing when no spaces were chosen", () => {
    expect(spaceNamesForEnquiry(enquiry(), spaces)).toEqual([]);
  });
});
