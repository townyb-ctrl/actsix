import { describe, expect, it } from "vitest";

import { hireOutcome, isDebriefStarted } from "./venueDebrief";
import type { VenuePayment } from "./venuePayments";
import type { VenueQuoteLine } from "./venueQuotes";

const line = (overrides: Partial<VenueQuoteLine> & { id: string }): VenueQuoteLine => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Venue",
  description: "Auditorium",
  quantity: 1,
  unit_price: 5000,
  sort_order: 0,
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const payment = (overrides: Partial<VenuePayment> & { id: string }): VenuePayment => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Payment",
  amount: 5000,
  paid_on: "2026-09-01",
  method: "EFT",
  reference: "",
  notes: "",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

describe("hireOutcome", () => {
  it("returns the whole bond when nothing was damaged", () => {
    const outcome = hireOutcome(
      [line({ id: "l1" })],
      [payment({ id: "p1" }), payment({ id: "p2", kind: "Bond", amount: 1500 })],
      0
    );

    expect(outcome.bondHeld).toBe(1500);
    expect(outcome.bondToReturn).toBe(1500);
    expect(outcome.unrecoveredDamage).toBe(0);
    expect(outcome.net).toBe(5000);
  });

  it("takes damage out of the bond before returning it", () => {
    const outcome = hireOutcome(
      [line({ id: "l1" })],
      [payment({ id: "p1" }), payment({ id: "p2", kind: "Bond", amount: 1500 })],
      400
    );

    expect(outcome.bondToReturn).toBe(1100);
    expect(outcome.unrecoveredDamage).toBe(0);
    expect(outcome.net).toBe(4600);
  });

  it("shows damage the bond did not cover instead of hiding it", () => {
    const outcome = hireOutcome(
      [line({ id: "l1" })],
      [payment({ id: "p1" }), payment({ id: "p2", kind: "Bond", amount: 1500 })],
      2000
    );

    expect(outcome.bondToReturn).toBe(0);
    expect(outcome.unrecoveredDamage).toBe(500);
    expect(outcome.net).toBe(3000);
  });

  it("counts damage with no bond at all as entirely unrecovered", () => {
    const outcome = hireOutcome([line({ id: "l1" })], [payment({ id: "p1" })], 750);

    expect(outcome.bondHeld).toBe(0);
    expect(outcome.bondToReturn).toBe(0);
    expect(outcome.unrecoveredDamage).toBe(750);
  });

  it("carries the unpaid balance through", () => {
    const outcome = hireOutcome([line({ id: "l1" })], [payment({ id: "p1", amount: 2000 })], 0);

    expect(outcome.charged).toBe(5000);
    expect(outcome.received).toBe(2000);
    expect(outcome.outstanding).toBe(3000);
  });

  it("ignores a negative damage cost rather than turning it into income", () => {
    const outcome = hireOutcome([line({ id: "l1" })], [payment({ id: "p1" })], -300);

    expect(outcome.damageCost).toBe(0);
    expect(outcome.net).toBe(5000);
  });

  it("works to the cent", () => {
    const outcome = hireOutcome(
      [line({ id: "l1", unit_price: 0.3 })],
      [payment({ id: "p1", amount: 0.3 }), payment({ id: "p2", kind: "Bond", amount: 0.2 })],
      0.1
    );

    expect(outcome.bondToReturn).toBe(0.1);
    expect(outcome.net).toBe(0.2);
  });
});

describe("isDebriefStarted", () => {
  it("is false on an untouched hire", () => {
    expect(
      isDebriefStarted({
        debrief_notes: "",
        debrief_completed_on: null,
        hirer_rating: null,
        would_host_again: null,
        damage_found: "",
        lessons_learned: "",
      })
    ).toBe(false);
  });

  it("is false when the only content is whitespace", () => {
    expect(isDebriefStarted({ debrief_notes: "   " })).toBe(false);
  });

  it("counts a would-not-host-again answer, not just a yes", () => {
    expect(isDebriefStarted({ would_host_again: false })).toBe(true);
  });

  it("counts a rating on its own", () => {
    expect(isDebriefStarted({ hirer_rating: 4 })).toBe(true);
  });
});
