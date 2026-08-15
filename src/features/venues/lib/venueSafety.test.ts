import { describe, expect, it } from "vitest";

import {
  incidentSummary,
  safetyGaps,
  sortIncidents,
  type VenueHireContact,
  type VenueIncident,
} from "./venueSafety";
import type { VenueHire } from "./venueHires";

const incident = (overrides: Partial<VenueIncident> & { id: string }): VenueIncident => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  space_id: null,
  occurred_at: "2026-09-11T20:00:00.000Z",
  severity: "Minor",
  category: "Other",
  summary: "Someone spilled a drink",
  action_taken: "",
  reported_by: "",
  resolved: false,
  resolved_at: null,
  created_at: "2026-09-11T20:00:00.000Z",
  updated_at: "2026-09-11T20:00:00.000Z",
  ...overrides,
});

const contact = (overrides: Partial<VenueHireContact> & { id: string }): VenueHireContact => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  service_contact_id: null,
  name: "Dana",
  role: "Duty manager",
  phone: "0821234567",
  notes: "",
  sort_order: 0,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const hire = (overrides: Partial<VenueHire> = {}): VenueHire =>
  ({
    id: "hire-1",
    security_required: false,
    security_provider: "",
    security_from: null,
    security_to: null,
    car_guards_required: false,
    car_guard_count: 0,
    access_plan: "",
    ...overrides,
  }) as VenueHire;

describe("sortIncidents", () => {
  it("puts open incidents above resolved ones", () => {
    const sorted = sortIncidents([
      incident({ id: "closed", resolved: true, severity: "Critical" }),
      incident({ id: "open" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["open", "closed"]);
  });

  it("puts the worst open incident first", () => {
    const sorted = sortIncidents([
      incident({ id: "minor" }),
      incident({ id: "critical", severity: "Critical" }),
      incident({ id: "serious", severity: "Serious" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["critical", "serious", "minor"]);
  });

  it("puts the most recent first among equals", () => {
    const sorted = sortIncidents([
      incident({ id: "older", occurred_at: "2026-09-11T18:00:00.000Z" }),
      incident({ id: "newer", occurred_at: "2026-09-11T21:00:00.000Z" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate the input", () => {
    const incidents = [incident({ id: "a", resolved: true }), incident({ id: "b" })];
    sortIncidents(incidents);

    expect(incidents.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("incidentSummary", () => {
  it("counts what is still open and what needs acting on", () => {
    const summary = incidentSummary([
      incident({ id: "a", severity: "Critical" }),
      incident({ id: "b", severity: "Minor" }),
      incident({ id: "c", severity: "Serious", resolved: true }),
    ]);

    expect(summary).toEqual({ total: 3, open: 2, needsAttention: 1 });
  });

  it("does not count a resolved serious incident as needing attention", () => {
    const summary = incidentSummary([
      incident({ id: "a", severity: "Critical", resolved: true }),
    ]);

    expect(summary.needsAttention).toBe(0);
  });
});

describe("safetyGaps", () => {
  it("says nothing when nothing was asked for", () => {
    expect(safetyGaps(hire(), [contact({ id: "c1" })])).toEqual([]);
  });

  it("flags security with no provider named", () => {
    const gaps = safetyGaps(hire({ security_required: true }), [contact({ id: "c1" })]);

    expect(gaps).toContain("Security is required but no provider is named");
  });

  it("flags security hours nobody set", () => {
    const gaps = safetyGaps(
      hire({ security_required: true, security_provider: "Night Owl" }),
      [contact({ id: "c1" })]
    );

    expect(gaps).toEqual(["Security hours are not set"]);
  });

  it("flags car guards required but none counted", () => {
    const gaps = safetyGaps(hire({ car_guards_required: true }), [contact({ id: "c1" })]);

    expect(gaps).toContain("Car guards are required but the number is zero");
  });

  it("flags a hire with nobody to call", () => {
    expect(safetyGaps(hire(), [])).toEqual(["Nobody is listed to call on the day"]);
  });

  it("flags a contact list where nobody has a number", () => {
    const gaps = safetyGaps(hire(), [contact({ id: "c1", phone: "  " })]);

    expect(gaps).toEqual(["No contact on the list has a phone number"]);
  });

  it("does not invent a security gap on a hire that needs no security", () => {
    const gaps = safetyGaps(hire({ security_provider: "" }), [contact({ id: "c1" })]);

    expect(gaps.some((gap) => gap.toLowerCase().includes("security"))).toBe(false);
  });
});
