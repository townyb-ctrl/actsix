import { describe, expect, it } from "vitest";

import { hiresToday, itemsForDay, nowAndNext } from "./venueEventDay";
import type { VenueBooking } from "./venueBookings";
import type { VenueHire } from "./venueHires";
import type { VenueRunSheetItem } from "./venueRunSheet";

const local = (year: number, month: number, day: number, hour: number, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).toISOString();

const hire = (overrides: Partial<VenueHire> & { id: string }): VenueHire =>
  ({ name: "Conference", ...overrides }) as VenueHire;

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking =>
  ({
    workspace_id: "workspace-1",
    space_id: "hall",
    hire_id: "hire-1",
    title: "Day 1",
    starts_at: local(2026, 9, 11, 9),
    ends_at: local(2026, 9, 11, 17),
    status: "Confirmed",
    ...overrides,
  }) as VenueBooking;

const item = (overrides: Partial<VenueRunSheetItem> & { id: string }): VenueRunSheetItem =>
  ({
    hire_id: "hire-1",
    space_id: "hall",
    title: "Doors open",
    starts_at: local(2026, 9, 11, 8),
    ends_at: local(2026, 9, 11, 9),
    sort_order: 0,
    ...overrides,
  }) as VenueRunSheetItem;

const day = new Date(2026, 8, 11);

describe("hiresToday", () => {
  it("lists a hire happening today with its bookings", () => {
    const today = hiresToday([hire({ id: "hire-1" })], [booking({ id: "b1" })], day);

    expect(today).toHaveLength(1);
    expect(today[0].bookings.map((entry) => entry.id)).toEqual(["b1"]);
  });

  it("leaves out a hire with nothing on today", () => {
    const today = hiresToday(
      [hire({ id: "hire-1" })],
      [booking({ id: "b1", starts_at: local(2026, 9, 20, 9), ends_at: local(2026, 9, 20, 17) })],
      day
    );

    expect(today).toEqual([]);
  });

  it("drops a hire whose bookings are all cancelled", () => {
    const today = hiresToday(
      [hire({ id: "hire-1" })],
      [booking({ id: "b1", status: "Cancelled" })],
      day
    );

    expect(today).toEqual([]);
  });

  it("includes a multi-day hire on its middle day", () => {
    const today = hiresToday(
      [hire({ id: "hire-1" })],
      [booking({ id: "b1", starts_at: local(2026, 9, 10, 9), ends_at: local(2026, 9, 12, 17) })],
      day
    );

    expect(today).toHaveLength(1);
  });

  it("orders hires by when they start today", () => {
    const today = hiresToday(
      [hire({ id: "late" }), hire({ id: "early" })],
      [
        booking({ id: "b1", hire_id: "late", starts_at: local(2026, 9, 11, 14) }),
        booking({ id: "b2", hire_id: "early", starts_at: local(2026, 9, 11, 8) }),
      ],
      day
    );

    expect(today.map((entry) => entry.hire.id)).toEqual(["early", "late"]);
  });

  it("orders a hire's own bookings chronologically", () => {
    const today = hiresToday(
      [hire({ id: "hire-1" })],
      [
        booking({ id: "afternoon", starts_at: local(2026, 9, 11, 14) }),
        booking({ id: "morning", starts_at: local(2026, 9, 11, 8) }),
      ],
      day
    );

    expect(today[0].bookings.map((entry) => entry.id)).toEqual(["morning", "afternoon"]);
  });
});

describe("itemsForDay", () => {
  it("keeps only what touches the day, in order", () => {
    const items = itemsForDay(
      [
        item({ id: "later", starts_at: local(2026, 9, 11, 12), ends_at: local(2026, 9, 11, 13) }),
        item({ id: "earlier" }),
        item({ id: "tomorrow", starts_at: local(2026, 9, 12, 8), ends_at: local(2026, 9, 12, 9) }),
      ],
      day
    );

    expect(items.map((entry) => entry.id)).toEqual(["earlier", "later"]);
  });
});

describe("nowAndNext", () => {
  const items = [
    item({ id: "morning", starts_at: local(2026, 9, 11, 8), ends_at: local(2026, 9, 11, 9) }),
    item({ id: "midday", starts_at: local(2026, 9, 11, 12), ends_at: local(2026, 9, 11, 13) }),
  ];

  it("finds what is running right now", () => {
    const { current, next } = nowAndNext(items, new Date(2026, 8, 11, 8, 30));

    expect(current.map((entry) => entry.id)).toEqual(["morning"]);
    expect(next?.id).toBe("midday");
  });

  it("reports more than one thing running in different rooms", () => {
    const { current } = nowAndNext(
      [
        ...items,
        item({
          id: "chapel",
          space_id: "chapel",
          starts_at: local(2026, 9, 11, 8),
          ends_at: local(2026, 9, 11, 10),
        }),
      ],
      new Date(2026, 8, 11, 8, 30)
    );

    expect(current.map((entry) => entry.id).sort()).toEqual(["chapel", "morning"]);
  });

  it("says nothing is running between items", () => {
    const { current, next } = nowAndNext(items, new Date(2026, 8, 11, 10));

    expect(current).toEqual([]);
    expect(next?.id).toBe("midday");
  });

  it("has no next once the day is over", () => {
    const { current, next } = nowAndNext(items, new Date(2026, 8, 11, 23));

    expect(current).toEqual([]);
    expect(next).toBeNull();
  });
});
