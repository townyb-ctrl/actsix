import { describe, expect, it } from "vitest";

import { bandForSpan, buildingStrip, deskSignals, type DeskHireInput } from "@/features/venues/lib/venueDesk";
import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import type { ChurchEvent } from "@/features/venues/lib/venueClashes";

const NOW = new Date("2026-08-17T14:00:00.000Z");

const hire = (over: Partial<VenueHire> = {}): VenueHire =>
  ({
    id: "hire-1",
    workspace_id: "w",
    user_id: "u",
    name: "Bodybuilding champs",
    event_type: "Competition",
    hirer_contact_id: null,
    hirer_name: "IFBB",
    hirer_email: "",
    hirer_phone: "",
    onsite_contact_name: "Claude",
    onsite_contact_phone: "084",
    status: "Confirmed",
    quote_status: "Sent",
    quote_sent_at: null,
    payment_terms: "",
    contract_clauses: "",
    contract_signed_on: null,
    contract_signed_by: "",
    enquiry_id: null,
    lessons_learned: "",
    debrief_notes: "",
    debrief_completed_on: null,
    hirer_rating: null,
    would_host_again: null,
    damage_found: "",
    damage_cost: 0,
    portal_token: null,
    portal_enabled: false,
    security_required: false,
    security_provider: "",
    security_from: null,
    security_to: null,
    car_guards_required: false,
    car_guard_count: 0,
    access_plan: "",
    av_preset_id: null,
    walkie_channels: "",
    notes: "",
    hirer_notes: "",
    created_at: "",
    updated_at: "",
    ...over,
  }) as VenueHire;

const booking = (startsAt: string, endsAt: string, over: Partial<VenueBooking> = {}): VenueBooking =>
  ({
    id: `b-${startsAt}`,
    workspace_id: "w",
    user_id: "u",
    space_id: "space-1",
    hire_id: "hire-1",
    title: "Main hall",
    booking_type: "external",
    hirer_contact_id: null,
    hirer_name: "",
    hirer_email: "",
    hirer_phone: "",
    starts_at: startsAt,
    ends_at: endsAt,
    status: "Confirmed",
    quoted_fee: 0,
    deposit_amount: 0,
    payment_status: "Unpaid",
    source: "staff",
    requested_features: [],
    needs_technician: false,
    technician_fee: 0,
    coffee_requested: false,
    coffee_fee: 0,
    notes: "",
    created_at: "",
    updated_at: "",
    ...over,
  }) as VenueBooking;

const entry = (over: Partial<DeskHireInput> = {}): DeskHireInput => ({
  hire: hire(),
  bookings: [],
  lines: [],
  payments: [],
  positions: [],
  assignments: [],
  turnaround: [],
  contacts: [],
  ...over,
});

describe("bandForSpan", () => {
  it("reads the calendar, not the status field", () => {
    expect(bandForSpan(null, NOW)).toBe("ahead");
    expect(
      bandForSpan({ startsAt: "2026-08-17T09:00:00.000Z", endsAt: "2026-08-17T18:00:00.000Z" }, NOW)
    ).toBe("now");
    expect(
      bandForSpan({ startsAt: "2026-08-10T09:00:00.000Z", endsAt: "2026-08-12T18:00:00.000Z" }, NOW)
    ).toBe("closing");
    expect(
      bandForSpan({ startsAt: "2026-09-30T09:00:00.000Z", endsAt: "2026-09-30T18:00:00.000Z" }, NOW)
    ).toBe("ahead");
  });
});

describe("deskSignals", () => {
  it("says nothing about a hire with nothing wrong", () => {
    const clean = entry({ bookings: [booking("2026-08-25T09:00:00.000Z", "2026-08-25T18:00:00.000Z")] });
    expect(deskSignals([clean], [], NOW)).toEqual([]);
  });

  it("ignores a cancelled hire entirely", () => {
    const dead = entry({ hire: hire({ status: "Cancelled" }) });
    expect(deskSignals([dead], [], NOW)).toEqual([]);
  });

  it("flags a hire with no dates held", () => {
    const signals = deskSignals([entry()], [], NOW);
    expect(signals.map((signal) => signal.title)).toContain("No dates held yet");
  });

  it("escalates missing cover only once the hire is close", () => {
    const near = entry({
      hire: hire({ onsite_contact_name: "  " }),
      bookings: [booking("2026-08-18T09:00:00.000Z", "2026-08-18T18:00:00.000Z")],
    });
    const far = entry({
      hire: hire({ onsite_contact_name: "  " }),
      bookings: [booking("2026-11-18T09:00:00.000Z", "2026-11-18T18:00:00.000Z")],
    });

    expect(deskSignals([near], [], NOW).map((s) => s.title)).toContain("Nobody to phone on the day");
    expect(deskSignals([far], [], NOW).map((s) => s.title)).not.toContain(
      "Nobody to phone on the day"
    );
  });

  it("orders by band first and heat second, never by money", () => {
    const running = entry({
      hire: hire({ id: "running", name: "Running", onsite_contact_name: "" }),
      bookings: [
        booking("2026-08-17T09:00:00.000Z", "2026-08-17T20:00:00.000Z", { hire_id: "running" }),
      ],
    });
    const later = entry({
      hire: hire({ id: "later", name: "Later" }),
      bookings: [booking("2026-12-01T09:00:00.000Z", "2026-12-01T18:00:00.000Z", { hire_id: "later" })],
      lines: [
        {
          id: "l1",
          workspace_id: "w",
          user_id: "u",
          hire_id: "later",
          kind: "Venue",
          description: "Hall",
          quantity: 1,
          unit_price: 100000,
          resource_id: null,
          sort_order: 0,
          created_at: "",
          updated_at: "",
        } as never,
      ],
    });

    const signals = deskSignals([later, running], [], NOW);
    expect(signals[0].band).toBe("now");
    expect(signals[0].hireName).toBe("Running");
  });

  it("only calls money hot once the event is over", () => {
    const lines = [
      {
        id: "l1",
        workspace_id: "w",
        user_id: "u",
        hire_id: "hire-1",
        kind: "Venue",
        description: "Hall",
        quantity: 1,
        unit_price: 500,
        resource_id: null,
        sort_order: 0,
        created_at: "",
        updated_at: "",
      } as never,
    ];

    const upcoming = deskSignals(
      [entry({ lines, bookings: [booking("2026-09-01T09:00:00.000Z", "2026-09-01T18:00:00.000Z")] })],
      [],
      NOW
    ).find((signal) => signal.id.endsWith(":owed"));
    const past = deskSignals(
      [entry({ lines, bookings: [booking("2026-07-01T09:00:00.000Z", "2026-07-01T18:00:00.000Z")] })],
      [],
      NOW
    ).find((signal) => signal.id.endsWith(":owed"));

    expect(upcoming?.weight).toBe("warm");
    expect(past?.weight).toBe("hot");
    expect(past?.title).toBe("Still owed, and the event is over");
  });
});

describe("buildingStrip", () => {
  const spaces = [
    { id: "space-1", color: "#2c7169" } as VenueSpace,
    { id: "space-2", color: "#3e4a73" } as VenueSpace,
  ];

  it("starts on the given day and runs the requested length", () => {
    const { days } = buildingStrip({ days: 14, bookings: [], spaces, events: [], from: NOW });
    expect(days).toHaveLength(14);
    expect(days[0].isToday).toBe(true);
    expect(days[1].isToday).toBe(false);
  });

  it("carries a multi-day booking onto every day it covers and marks the continuation", () => {
    const { days } = buildingStrip({
      days: 5,
      bookings: [booking("2026-08-18T09:00:00.000Z", "2026-08-20T18:00:00.000Z")],
      spaces,
      events: [],
      from: NOW,
    });

    expect(days[0].entries).toHaveLength(0);
    expect(days[1].entries[0].continues).toBe(false);
    expect(days[2].entries[0].continues).toBe(true);
    expect(days[3].entries[0].continues).toBe(true);
    expect(days[4].entries).toHaveLength(0);
  });

  it("holds a room's lane across the window even when another room fills up beside it", () => {
    const { days } = buildingStrip({
      days: 4,
      bookings: [
        // Runs the whole window in space-1.
        booking("2026-08-17T09:00:00.000Z", "2026-08-20T18:00:00.000Z", { id: "long" }),
        // One day in space-2, starting earlier - the case that used to shove
        // the long run down a lane on that day alone.
        booking("2026-08-18T06:00:00.000Z", "2026-08-18T08:00:00.000Z", {
          id: "short",
          space_id: "space-2",
        }),
      ],
      spaces,
      events: [],
      from: NOW,
    });

    const laneOf = (dayIndex: number, id: string) =>
      days[dayIndex].lanes.findIndex((entry) => entry?.id === id);

    expect(laneOf(0, "long")).toBe(0);
    expect(laneOf(1, "long")).toBe(0);
    expect(laneOf(2, "long")).toBe(0);
    expect(laneOf(1, "short")).toBe(1);
    // The day the short booking is absent still reserves its lane.
    expect(days[2].lanes).toHaveLength(2);
    expect(days[2].lanes[1]).toBeNull();
  });

  it("draws the church diary in the same strip as the hires, in the last lane", () => {
    const event: ChurchEvent = {
      id: "e1",
      title: "Prayer meeting",
      calendar_name: "Church",
      space_id: "space-1",
      starts_at: "2026-08-17T18:00:00.000Z",
      ends_at: "2026-08-17T20:00:00.000Z",
      all_day: false,
      status: "Confirmed",
    };

    const { days } = buildingStrip({
      days: 2,
      bookings: [booking("2026-08-17T09:00:00.000Z", "2026-08-17T12:00:00.000Z")],
      spaces,
      events: [event],
      from: NOW,
    });

    expect(days[0].entries.map((item) => item.kind)).toEqual(["hire", "church"]);
  });

  it("leaves cancelled bookings and cancelled events off the building", () => {
    const { days, roll } = buildingStrip({
      days: 2,
      bookings: [
        booking("2026-08-17T09:00:00.000Z", "2026-08-17T18:00:00.000Z", { status: "Cancelled" }),
      ],
      spaces,
      events: [
        {
          id: "e1",
          title: "Cancelled thing",
          calendar_name: "Church",
          space_id: "space-1",
          starts_at: "2026-08-17T18:00:00.000Z",
          ends_at: "2026-08-17T20:00:00.000Z",
          all_day: false,
          status: "Cancelled",
        },
      ],
      from: NOW,
    });

    expect(days[0].entries).toEqual([]);
    expect(roll).toEqual([]);
  });

  it("rolls a hire's several bookings into one row, named after the hire", () => {
    const { roll } = buildingStrip({
      days: 7,
      bookings: [
        booking("2026-08-18T09:00:00.000Z", "2026-08-18T18:00:00.000Z", { id: "b1" }),
        booking("2026-08-20T09:00:00.000Z", "2026-08-21T18:00:00.000Z", {
          id: "b2",
          space_id: "space-2",
        }),
      ],
      spaces,
      events: [],
      hires: [hire()],
      from: NOW,
    });

    expect(roll).toHaveLength(1);
    expect(roll[0].title).toBe("Bodybuilding champs");
    expect(roll[0].startsAt).toBe("2026-08-18T09:00:00.000Z");
    expect(roll[0].endsAt).toBe("2026-08-21T18:00:00.000Z");
  });
});
