import { describe, expect, it } from "vitest";

import { findClashes, type ChurchEvent } from "./venueClashes";
import type { VenueBooking } from "./venueBookings";

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  hire_id: "hire-1",
  title: "Conference day 1",
  booking_type: "external",
  hirer_contact_id: null,
  hirer_name: "",
  hirer_email: "",
  hirer_phone: "",
  starts_at: "2026-09-10T10:00:00.000Z",
  ends_at: "2026-09-10T14:00:00.000Z",
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
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const event = (overrides: Partial<ChurchEvent> & { id: string }): ChurchEvent => ({
  title: "Worship practice",
  calendar_name: "ACTSIX",
  space_id: "hall",
  starts_at: "2026-09-10T12:00:00.000Z",
  ends_at: "2026-09-10T13:00:00.000Z",
  all_day: false,
  status: "Confirmed",
  ...overrides,
});

describe("findClashes", () => {
  it("reports an event that overlaps a booking in the same space", () => {
    const report = findClashes([booking({ id: "b1" })], [event({ id: "e1" })]);

    expect(report.clashes).toHaveLength(1);
    expect(report.clashes[0].booking.id).toBe("b1");
    expect(report.clashes[0].event.id).toBe("e1");
    expect(report.uncheckedCount).toBe(0);
  });

  it("ignores an overlapping event in a different space", () => {
    const report = findClashes(
      [booking({ id: "b1" })],
      [event({ id: "e1", space_id: "chapel" })]
    );

    expect(report.clashes).toHaveLength(0);
    expect(report.uncheckedCount).toBe(0);
  });

  it("treats back-to-back use as fine, not a clash", () => {
    const report = findClashes(
      [booking({ id: "b1" })],
      [
        event({
          id: "e1",
          starts_at: "2026-09-10T14:00:00.000Z",
          ends_at: "2026-09-10T16:00:00.000Z",
        }),
      ]
    );

    expect(report.clashes).toHaveLength(0);
  });

  it("counts an overlapping event with no space instead of clearing it", () => {
    const report = findClashes(
      [booking({ id: "b1" })],
      [event({ id: "e1", space_id: null })]
    );

    expect(report.clashes).toHaveLength(0);
    expect(report.uncheckedCount).toBe(1);
  });

  it("does not count a spaceless event that falls outside the hire at all", () => {
    const report = findClashes(
      [booking({ id: "b1" })],
      [
        event({
          id: "e1",
          space_id: null,
          starts_at: "2026-10-01T09:00:00.000Z",
          ends_at: "2026-10-01T10:00:00.000Z",
        }),
      ]
    );

    expect(report.uncheckedCount).toBe(0);
  });

  it("ignores a cancelled booking - it is not occupying the room", () => {
    const report = findClashes(
      [booking({ id: "b1", status: "Cancelled" })],
      [event({ id: "e1" })]
    );

    expect(report.clashes).toHaveLength(0);
    expect(report.uncheckedCount).toBe(0);
  });

  it("ignores a cancelled event", () => {
    const report = findClashes(
      [booking({ id: "b1" })],
      [event({ id: "e1", status: "Cancelled" })]
    );

    expect(report.clashes).toHaveLength(0);
  });

  it("still reports a tentative event, because a maybe is worth knowing before quoting", () => {
    const report = findClashes(
      [booking({ id: "b1" })],
      [event({ id: "e1", status: "Tentative" })]
    );

    expect(report.clashes).toHaveLength(1);
  });

  it("reports one clash per booking an event straddles", () => {
    const report = findClashes(
      [
        booking({ id: "b1", ends_at: "2026-09-10T12:30:00.000Z" }),
        booking({
          id: "b2",
          starts_at: "2026-09-10T12:30:00.000Z",
          ends_at: "2026-09-10T16:00:00.000Z",
        }),
      ],
      [
        event({
          id: "e1",
          starts_at: "2026-09-10T12:00:00.000Z",
          ends_at: "2026-09-10T13:00:00.000Z",
        }),
      ]
    );

    expect(report.clashes.map((clash) => clash.booking.id)).toEqual(["b1", "b2"]);
  });

  it("orders clashes by when the booking starts", () => {
    const report = findClashes(
      [
        booking({
          id: "later",
          starts_at: "2026-09-11T10:00:00.000Z",
          ends_at: "2026-09-11T14:00:00.000Z",
        }),
        booking({ id: "earlier" }),
      ],
      [
        event({ id: "e1" }),
        event({
          id: "e2",
          starts_at: "2026-09-11T12:00:00.000Z",
          ends_at: "2026-09-11T13:00:00.000Z",
        }),
      ]
    );

    expect(report.clashes.map((clash) => clash.booking.id)).toEqual(["earlier", "later"]);
  });
});
