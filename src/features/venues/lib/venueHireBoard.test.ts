import { describe, expect, it } from "vitest";

import {
  clearingLatch,
  hireBoard,
  newVisit,
  openConcerns,
  settledConcerns,
  type HireBoardInput,
  type HireConcernId,
} from "@/features/venues/lib/venueHireBoard";
import type { VenueBooking } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";

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
    status: "Draft",
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

const line = (unitPrice: number) =>
  ({
    id: "l1",
    workspace_id: "w",
    user_id: "u",
    hire_id: "hire-1",
    kind: "Venue",
    description: "Hall",
    quantity: 1,
    unit_price: unitPrice,
    resource_id: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  }) as never;

const board = (over: Partial<HireBoardInput> = {}) =>
  hireBoard({
    hire: hire(),
    bookings: [],
    spaces: [{ id: "space-1", name: "Revolve Hall" } as never],
    churchEvents: [],
    lines: [],
    payments: [],
    runSheetItems: [],
    positions: [],
    assignments: [],
    incidents: [],
    contacts: [{ id: "c1", phone: "084" } as never],
    signs: [],
    signLinks: [],
    checkouts: [],
    walkthroughs: [],
    turnaround: [],
    now: NOW,
    ...over,
  });

const find = (input: Partial<HireBoardInput>, id: HireConcernId) =>
  board(input).find((concern) => concern.id === id)!;

describe("hireBoard", () => {
  it("names every concern exactly once, in the hire's own order", () => {
    const ids = board().map((concern) => concern.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("dates");
    expect(ids[ids.length - 1]).toBe("notes");
  });

  it("calls an unbooked hire out first", () => {
    const dates = find({}, "dates");
    expect(dates.attention).toBe("hot");
    expect(dates.status).toBe("nothing booked");
  });

  it("settles a booked hire and says where and how long", () => {
    const dates = find(
      { bookings: [booking("2026-09-01T09:00:00.000Z", "2026-09-02T18:00:00.000Z")] },
      "dates"
    );
    expect(dates.attention).toBeNull();
    expect(dates.status).toContain("Revolve Hall");
  });

  it("escalates unfilled positions only once the hire is close", () => {
    const positions = [
      { id: "p1", hire_id: "hire-1", role_id: "r", needed: 2, starts_at: "", ends_at: "" } as never,
    ];

    const near = find(
      { bookings: [booking("2026-08-19T09:00:00.000Z", "2026-08-19T18:00:00.000Z")], positions },
      "positions"
    );
    const far = find(
      { bookings: [booking("2026-12-19T09:00:00.000Z", "2026-12-19T18:00:00.000Z")], positions },
      "positions"
    );

    expect(near.attention).toBe("hot");
    expect(far.attention).toBe("warm");
    expect(near.status).toBe("2 still to fill");
  });

  it("only calls money hot once the event is over", () => {
    const lines = [line(500)];

    const upcoming = find(
      { lines, bookings: [booking("2026-09-01T09:00:00.000Z", "2026-09-01T18:00:00.000Z")] },
      "payments"
    );
    const past = find(
      { lines, bookings: [booking("2026-07-01T09:00:00.000Z", "2026-07-01T18:00:00.000Z")] },
      "payments"
    );

    expect(upcoming.attention).toBe("warm");
    expect(past.attention).toBe("hot");
  });

  it("treats a contract signed against a draft quote as a contradiction", () => {
    const contract = find(
      { hire: hire({ quote_status: "Draft", contract_signed_on: "2026-08-01" }) },
      "contract"
    );
    expect(contract.attention).toBe("hot");
    expect(contract.status).toBe("signed against a draft quote");
  });

  it("wants a walkthrough only after the hire is over", () => {
    const before = find(
      { bookings: [booking("2026-09-01T09:00:00.000Z", "2026-09-01T18:00:00.000Z")] },
      "walkthrough"
    );
    const after = find(
      { bookings: [booking("2026-07-01T09:00:00.000Z", "2026-07-01T18:00:00.000Z")] },
      "walkthrough"
    );

    expect(before.attention).toBeNull();
    expect(after.attention).toBe("hot");
  });

  it("never reports a broken feed as settled", () => {
    const payments = find({ failed: { payments: true } }, "payments");
    expect(payments.failed).toBe(true);
    expect(payments.attention).toBe("warm");
    expect(payments.status).toBe("could not be loaded");
  });

  it("keeps the hirer link and notes out of the way of real work", () => {
    expect(find({}, "portal").attention).toBeNull();
    expect(find({ hire: hire({ notes: "careful with the floor" }) }, "notes").status).toBe("1 note");
  });
});

describe("openConcerns / settledConcerns", () => {
  it("splits the board and puts the hot ones first", () => {
    const rows = board({
      // Unbooked (hot) and an unsent draft quote (warm) at the same time.
      hire: hire({ quote_status: "Draft" }),
      lines: [line(500)],
    });

    const open = openConcerns(rows);
    const settled = settledConcerns(rows);

    expect(open[0].attention).toBe("hot");
    expect(open.map((c) => c.id)).toContain("quote");
    expect(open.every((c) => c.attention !== null)).toBe(true);
    expect(settled.every((c) => c.attention === null)).toBe(true);
    expect(open.length + settled.length).toBe(rows.length);
  });

  it("leaves nothing open on a hire with nothing wrong", () => {
    const rows = board({
      bookings: [booking("2026-09-01T09:00:00.000Z", "2026-09-02T18:00:00.000Z")],
    });
    expect(openConcerns(rows)).toEqual([]);
  });
});

describe("clearingLatch", () => {
  it("does not mark a hire that was already in hand on arrival", () => {
    const latch = clearingLatch(newVisit(), 0);
    expect(latch.clearedThisVisit).toBe(false);
  });

  it("marks the hire when the last concern goes quiet while watching", () => {
    let latch = clearingLatch(newVisit(), 3);
    expect(latch.clearedThisVisit).toBe(false);

    latch = clearingLatch(latch, 0);
    expect(latch.clearedThisVisit).toBe(true);
  });

  it("holds the mark across further renders, including StrictMode's double one", () => {
    let latch = clearingLatch(clearingLatch(newVisit(), 1), 0);
    latch = clearingLatch(latch, 0);
    latch = clearingLatch(latch, 0);
    expect(latch.clearedThisVisit).toBe(true);
  });

  it("drops the mark if something starts wanting a person again", () => {
    let latch = clearingLatch(clearingLatch(newVisit(), 2), 0);
    latch = clearingLatch(latch, 1);
    expect(latch.clearedThisVisit).toBe(false);
  });

  it("starts clean on a new visit, so finishing one hire does not mark the next", () => {
    const finished = clearingLatch(clearingLatch(newVisit(), 2), 0);
    expect(finished.clearedThisVisit).toBe(true);
    expect(clearingLatch(newVisit(), 0).clearedThisVisit).toBe(false);
  });
});
