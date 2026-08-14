import { describe, expect, it } from "vitest";

import { bookingsByDay, hireSpan } from "./venueHires";
import type { VenueBooking } from "./venueBookings";

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  hire_id: "hire-1",
  title: "Booking",
  booking_type: "external",
  hirer_contact_id: null,
  hirer_name: "",
  hirer_email: "",
  hirer_phone: "",
  starts_at: "2026-09-10T08:00:00.000Z",
  ends_at: "2026-09-10T12:00:00.000Z",
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

describe("hireSpan", () => {
  it("runs from the earliest start to the latest end across every booking", () => {
    const span = hireSpan([
      booking({ id: "b1", starts_at: "2026-09-11T08:00:00.000Z", ends_at: "2026-09-11T12:00:00.000Z" }),
      booking({ id: "b2", starts_at: "2026-09-09T18:00:00.000Z", ends_at: "2026-09-09T21:00:00.000Z" }),
      booking({ id: "b3", starts_at: "2026-09-10T08:00:00.000Z", ends_at: "2026-09-10T23:00:00.000Z" }),
    ]);

    expect(span?.startsAt).toBe("2026-09-09T18:00:00.000Z");
    expect(span?.endsAt).toBe("2026-09-11T12:00:00.000Z");
  });

  it("counts every calendar day the hire touches, not the number of bookings", () => {
    const span = hireSpan([
      booking({ id: "b1", starts_at: "2026-09-09T18:00:00.000Z", ends_at: "2026-09-09T21:00:00.000Z" }),
      booking({ id: "b2", starts_at: "2026-09-11T08:00:00.000Z", ends_at: "2026-09-11T12:00:00.000Z" }),
    ]);

    // 9th, 10th, 11th - the 10th counts even though nothing is booked on it.
    expect(span?.dayCount).toBe(3);
  });

  it("counts a single same-day booking as one day", () => {
    expect(hireSpan([booking({ id: "b1" })])?.dayCount).toBe(1);
  });

  it("ignores cancelled bookings, which no longer occupy the building", () => {
    const span = hireSpan([
      booking({ id: "b1", starts_at: "2026-09-10T08:00:00.000Z", ends_at: "2026-09-10T12:00:00.000Z" }),
      booking({
        id: "b2",
        status: "Cancelled",
        starts_at: "2026-09-20T08:00:00.000Z",
        ends_at: "2026-09-20T12:00:00.000Z",
      }),
    ]);

    expect(span?.endsAt).toBe("2026-09-10T12:00:00.000Z");
    expect(span?.dayCount).toBe(1);
  });

  it("is null for a hire with nothing booked yet", () => {
    expect(hireSpan([])).toBeNull();
    expect(hireSpan([booking({ id: "b1", status: "Cancelled" })])).toBeNull();
  });
});

describe("bookingsByDay", () => {
  it("groups bookings under the day they start, in chronological order", () => {
    const second = booking({
      id: "b2",
      starts_at: "2026-09-10T14:00:00.000Z",
      ends_at: "2026-09-10T18:00:00.000Z",
    });
    const first = booking({
      id: "b1",
      starts_at: "2026-09-10T08:00:00.000Z",
      ends_at: "2026-09-10T12:00:00.000Z",
    });
    const nextDay = booking({
      id: "b3",
      starts_at: "2026-09-11T08:00:00.000Z",
      ends_at: "2026-09-11T12:00:00.000Z",
    });

    const days = bookingsByDay([nextDay, second, first]);

    expect(days).toHaveLength(2);
    expect(days[0].bookings.map((entry) => entry.id)).toEqual(["b1", "b2"]);
    expect(days[1].bookings.map((entry) => entry.id)).toEqual(["b3"]);
  });

  it("keeps cancelled bookings visible - the coordinator still needs to see them", () => {
    const days = bookingsByDay([booking({ id: "b1", status: "Cancelled" })]);

    expect(days).toHaveLength(1);
    expect(days[0].bookings).toHaveLength(1);
  });

  it("returns nothing for a hire with no bookings", () => {
    expect(bookingsByDay([])).toEqual([]);
  });
});
