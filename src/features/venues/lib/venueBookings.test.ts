import { describe, expect, it } from "vitest";

import { findConflicts, type VenueBooking } from "./venueBookings";

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  title: "Existing booking",
  booking_type: "internal",
  hirer_contact_id: null,
  hirer_name: "",
  hirer_email: "",
  hirer_phone: "",
  starts_at: "2026-08-10T10:00:00.000Z",
  ends_at: "2026-08-10T12:00:00.000Z",
  status: "Confirmed",
  quoted_fee: 0,
  deposit_amount: 0,
  payment_status: "Not applicable",
  source: "staff",
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const candidate = {
  spaceId: "hall",
  startsAt: "2026-08-10T11:00:00.000Z",
  endsAt: "2026-08-10T13:00:00.000Z",
};

describe("findConflicts", () => {
  it("returns a booking that partially overlaps the candidate", () => {
    const existing = booking({ id: "b1" });

    expect(findConflicts(candidate, [existing])).toEqual([existing]);
  });

  it("returns a booking that fully contains the candidate", () => {
    const existing = booking({
      id: "b1",
      starts_at: "2026-08-10T09:00:00.000Z",
      ends_at: "2026-08-10T18:00:00.000Z",
    });

    expect(findConflicts(candidate, [existing])).toEqual([existing]);
  });

  it("returns a booking the candidate fully contains", () => {
    const existing = booking({
      id: "b1",
      starts_at: "2026-08-10T11:30:00.000Z",
      ends_at: "2026-08-10T11:45:00.000Z",
    });

    expect(findConflicts(candidate, [existing])).toEqual([existing]);
  });

  it("treats back-to-back bookings as no conflict", () => {
    const before = booking({
      id: "b1",
      starts_at: "2026-08-10T09:00:00.000Z",
      ends_at: "2026-08-10T11:00:00.000Z",
    });
    const after = booking({
      id: "b2",
      starts_at: "2026-08-10T13:00:00.000Z",
      ends_at: "2026-08-10T15:00:00.000Z",
    });

    expect(findConflicts(candidate, [before, after])).toEqual([]);
  });

  it("ignores cancelled bookings", () => {
    const existing = booking({ id: "b1", status: "Cancelled" });

    expect(findConflicts(candidate, [existing])).toEqual([]);
  });

  it("conflicts with pending bookings, not only confirmed ones", () => {
    const existing = booking({ id: "b1", status: "Pending" });

    expect(findConflicts(candidate, [existing])).toEqual([existing]);
  });

  it("ignores bookings in a different space", () => {
    const existing = booking({ id: "b1", space_id: "chapel" });

    expect(findConflicts(candidate, [existing])).toEqual([]);
  });

  it("excludes the candidate's own row when editing", () => {
    const existing = booking({ id: "b1" });

    expect(findConflicts({ ...candidate, id: "b1" }, [existing])).toEqual([]);
  });

  it("returns every conflicting booking", () => {
    const first = booking({ id: "b1" });
    const second = booking({
      id: "b2",
      starts_at: "2026-08-10T12:30:00.000Z",
      ends_at: "2026-08-10T14:00:00.000Z",
    });

    expect(findConflicts(candidate, [first, second])).toEqual([first, second]);
  });
});
