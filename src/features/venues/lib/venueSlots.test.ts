import { describe, expect, it } from "vitest";

import {
  bookableDays,
  dayKey,
  slotCost,
  slotsForSpace,
  spanFromSlots,
} from "@/features/venues/lib/venueSlots";
import type { VenueBooking } from "@/features/venues/lib/venueBookings";

const at = (key: string, hour: number) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
};

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking =>
  ({
    workspace_id: "workspace-1",
    user_id: "user-1",
    space_id: "hall",
    hire_id: "hire-1",
    title: "Youth night",
    booking_type: "external",
    status: "Confirmed",
    starts_at: at("2026-08-19", 18),
    ends_at: at("2026-08-19", 21),
    ...overrides,
  }) as VenueBooking;

const hourOf = (slots: ReturnType<typeof slotsForSpace>, hour: number) =>
  slots.find((slot) => slot.hour === hour)!;

describe("slotsForSpace", () => {
  const key = "2026-08-19";

  it("marks every hour a booking touches as taken, and no others", () => {
    const slots = slotsForSpace({
      spaceId: "hall",
      key,
      bookings: [booking({ id: "b1" })],
    });

    expect(hourOf(slots, 17).takenBy).toBeNull();
    expect(hourOf(slots, 18).takenBy?.title).toBe("Youth night");
    expect(hourOf(slots, 20).takenBy?.title).toBe("Youth night");
    // Ends at 21:00, so the 21:00-22:00 hour is free again.
    expect(hourOf(slots, 21).takenBy).toBeNull();
  });

  it("frees an hour back up when the booking is cancelled", () => {
    const slots = slotsForSpace({
      spaceId: "hall",
      key,
      bookings: [booking({ id: "b1", status: "Cancelled" })],
    });

    expect(hourOf(slots, 18).takenBy).toBeNull();
  });

  it("does not let a booking being edited clash with itself", () => {
    const slots = slotsForSpace({
      spaceId: "hall",
      key,
      bookings: [booking({ id: "b1" })],
      excludeBookingId: "b1",
    });

    expect(hourOf(slots, 18).takenBy).toBeNull();
  });

  it("keeps other spaces out of it", () => {
    const slots = slotsForSpace({
      spaceId: "chapel",
      key,
      bookings: [booking({ id: "b1", space_id: "hall" })],
    });

    expect(slots.every((slot) => slot.takenBy === null)).toBe(true);
  });

  it("marks the hours the current selection covers", () => {
    const slots = slotsForSpace({
      spaceId: "hall",
      key,
      bookings: [],
      selection: { spaceId: "hall", startsAt: at(key, 15), endsAt: at(key, 17) },
    });

    expect(hourOf(slots, 14).selected).toBe(false);
    expect(hourOf(slots, 15).selected).toBe(true);
    expect(hourOf(slots, 16).selected).toBe(true);
    expect(hourOf(slots, 17).selected).toBe(false);
  });

  it("does not mark a selection made in another space", () => {
    const slots = slotsForSpace({
      spaceId: "chapel",
      key,
      bookings: [],
      selection: { spaceId: "hall", startsAt: at(key, 15), endsAt: at(key, 17) },
    });

    expect(slots.every((slot) => !slot.selected)).toBe(true);
  });
});

describe("spanFromSlots", () => {
  it("books the single hour that was clicked", () => {
    const span = spanFromSlots("2026-08-19", 15, 15);

    expect(span.startsAt.getHours()).toBe(15);
    expect(span.endsAt.getHours()).toBe(16);
  });

  it("covers both ends, whichever was clicked first", () => {
    const forwards = spanFromSlots("2026-08-19", 14, 16);
    const backwards = spanFromSlots("2026-08-19", 16, 14);

    expect(forwards.startsAt.getTime()).toBe(backwards.startsAt.getTime());
    expect(forwards.endsAt.getTime()).toBe(backwards.endsAt.getTime());
    expect(forwards.startsAt.getHours()).toBe(14);
    expect(forwards.endsAt.getHours()).toBe(17);
  });
});

describe("bookableDays", () => {
  it("offers the hire's own days, including the ones between", () => {
    const days = bookableDays({
      hireBookings: [
        booking({ id: "b1", starts_at: at("2026-08-19", 15), ends_at: at("2026-08-19", 17) }),
        booking({ id: "b2", starts_at: at("2026-08-22", 8), ends_at: at("2026-08-22", 16) }),
      ],
    });

    expect(days).toEqual(["2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"]);
  });

  it("offers the week ahead when the hire holds nothing yet", () => {
    const days = bookableDays({
      hireBookings: [],
      today: new Date(2026, 7, 17),
      span: 3,
    });

    expect(days).toEqual(["2026-08-17", "2026-08-18", "2026-08-19"]);
  });

  it("always includes the day being looked at", () => {
    const days = bookableDays({
      hireBookings: [],
      today: new Date(2026, 7, 17),
      span: 2,
      selectedKey: "2026-12-24",
    });

    expect(days).toContain("2026-12-24");
  });

  it("does not print a season of chips for a long-running hire", () => {
    const days = bookableDays({
      hireBookings: [
        booking({ id: "b1", starts_at: at("2026-01-01", 9), ends_at: at("2026-01-01", 10) }),
        booking({ id: "b2", starts_at: at("2026-06-01", 9), ends_at: at("2026-06-01", 10) }),
      ],
    });

    expect(days.length).toBeLessThanOrEqual(22);
  });
});

describe("slotCost", () => {
  it("charges by the hour", () => {
    expect(slotCost({ hourlyRate: 250, dailyRate: 0, hours: 3 })).toBe(750);
  });

  it("stops at the day rate once the hours pass it", () => {
    expect(slotCost({ hourlyRate: 250, dailyRate: 850, hours: 8 })).toBe(850);
  });

  it("is nothing when nothing is picked", () => {
    expect(slotCost({ hourlyRate: 250, dailyRate: 850, hours: 0 })).toBe(0);
  });
});

describe("dayKey", () => {
  it("keeps the local day, either side of UTC", () => {
    expect(dayKey(new Date(2026, 7, 19, 1, 30))).toBe("2026-08-19");
    expect(dayKey(new Date(2026, 7, 19, 23, 30))).toBe("2026-08-19");
  });
});
