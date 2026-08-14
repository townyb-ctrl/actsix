import { describe, expect, it } from "vitest";

import { planClone } from "./venueClone";
import type { VenueBooking } from "./venueBookings";
import type { VenuePosition } from "./venuePositions";
import type { VenueQuoteLine } from "./venueQuotes";
import type { VenueRunSheetItem } from "./venueRunSheet";

/** Local wall-clock time as an ISO string, so a shift can be asserted on the clock face. */
const local = (year: number, month: number, day: number, hour: number, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).toISOString();

const localParts = (iso: string) => {
  const date = new Date(iso);
  return {
    day: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`,
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
};

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  hire_id: "hire-1",
  title: "Day 1",
  booking_type: "external",
  hirer_contact_id: null,
  hirer_name: "",
  hirer_email: "",
  hirer_phone: "",
  starts_at: local(2026, 9, 11, 9),
  ends_at: local(2026, 9, 11, 17),
  status: "Confirmed",
  quoted_fee: 0,
  deposit_amount: 0,
  payment_status: "Not applicable",
  source: "staff",
  requested_features: [],
  needs_technician: false,
  technician_fee: 0,
  coffee_requested: false,
  coffee_fee: 0,
  notes: "Chairs in rows",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const line = (overrides: Partial<VenueQuoteLine> & { id: string }): VenueQuoteLine => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Venue",
  description: "Auditorium",
  quantity: 2,
  unit_price: 2500,
  sort_order: 0,
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const runSheetItem = (
  overrides: Partial<VenueRunSheetItem> & { id: string }
): VenueRunSheetItem => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  space_id: "hall",
  title: "Doors open",
  starts_at: local(2026, 9, 11, 8, 30),
  ends_at: local(2026, 9, 11, 9),
  setup_notes: "",
  av_notes: "",
  access_notes: "",
  risk_notes: "",
  sort_order: 0,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const position = (overrides: Partial<VenuePosition> & { id: string }): VenuePosition => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  role_id: "role-usher",
  starts_at: local(2026, 9, 11, 8),
  ends_at: local(2026, 9, 11, 18),
  needed: 2,
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const source = {
  bookings: [booking({ id: "b1" })],
  lines: [line({ id: "l1" })],
  runSheetItems: [runSheetItem({ id: "r1" })],
  positions: [position({ id: "pos1" })],
};

describe("planClone", () => {
  it("moves the first booked day onto the chosen day", () => {
    const plan = planClone(source, "2027-09-10");

    expect(localParts(plan.bookings[0].starts_at).day).toBe("2027-09-10");
    expect(plan.offsetDays).toBe(364);
  });

  it("keeps the time of day", () => {
    const plan = planClone(source, "2027-09-10");

    expect(localParts(plan.bookings[0].starts_at).time).toBe("09:00");
    expect(localParts(plan.bookings[0].ends_at).time).toBe("17:00");
  });

  it("keeps the gap between days of a multi-day hire", () => {
    const plan = planClone(
      {
        ...source,
        bookings: [
          booking({ id: "b1" }),
          booking({
            id: "b2",
            starts_at: local(2026, 9, 13, 9),
            ends_at: local(2026, 9, 13, 12),
          }),
        ],
      },
      "2027-09-10"
    );

    const days = plan.bookings.map((entry) => localParts(entry.starts_at).day).sort();
    expect(days).toEqual(["2027-09-10", "2027-09-12"]);
  });

  it("shifts the run sheet and the positions by the same amount", () => {
    const plan = planClone(source, "2027-09-10");

    expect(localParts(plan.runSheetItems[0].starts_at).day).toBe("2027-09-10");
    expect(localParts(plan.runSheetItems[0].starts_at).time).toBe("08:30");
    expect(localParts(plan.positions[0].starts_at).day).toBe("2027-09-10");
    expect(localParts(plan.positions[0].starts_at).time).toBe("08:00");
  });

  it("copies the price unchanged", () => {
    const plan = planClone(source, "2027-09-10");

    expect(plan.lines[0]).toMatchObject({ kind: "Venue", quantity: 2, unit_price: 2500 });
  });

  it("copies how many people a position needs, never who filled it", () => {
    const plan = planClone(source, "2027-09-10");

    expect(plan.positions[0].needed).toBe(2);
    expect(Object.keys(plan.positions[0])).not.toContain("assignments");
  });

  it("drops a cancelled booking", () => {
    const plan = planClone(
      { ...source, bookings: [booking({ id: "b1" }), booking({ id: "b2", status: "Cancelled" })] },
      "2027-09-10"
    );

    expect(plan.bookings).toHaveLength(1);
  });

  it("anchors on the earliest booking even when they arrive out of order", () => {
    const plan = planClone(
      {
        ...source,
        bookings: [
          booking({
            id: "late",
            starts_at: local(2026, 9, 13, 9),
            ends_at: local(2026, 9, 13, 12),
          }),
          booking({ id: "early" }),
        ],
      },
      "2027-09-10"
    );

    expect(plan.offsetDays).toBe(364);
  });

  it("copies the quote unshifted when the hire has no bookings to anchor on", () => {
    const plan = planClone({ ...source, bookings: [] }, "2027-09-10");

    expect(plan.offsetDays).toBe(0);
    expect(plan.bookings).toHaveLength(0);
    expect(plan.lines).toHaveLength(1);
  });
});
