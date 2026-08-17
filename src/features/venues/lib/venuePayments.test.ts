import { describe, expect, it } from "vitest";

import { paymentSummary, type VenuePayment } from "./venuePayments";
import type { VenueQuoteLine } from "./venueQuotes";

const payment = (overrides: Partial<VenuePayment> & { id: string }): VenuePayment => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Payment",
  amount: 1000,
  paid_on: "2026-09-01",
  method: "EFT",
  reference: "",
  notes: "",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

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

describe("paymentSummary", () => {
  it("owes the full quote when nothing has been paid", () => {
    const summary = paymentSummary([line({ id: "l1" })], []);

    expect(summary).toEqual({
      charged: 5000,
      received: 0,
      refunded: 0,
      outstanding: 5000,
      bondHeld: 0,
      isSettled: false,
    });
  });

  it("reduces what is outstanding as payments arrive", () => {
    const summary = paymentSummary(
      [line({ id: "l1" })],
      [payment({ id: "p1", amount: 2000 })]
    );

    expect(summary.received).toBe(2000);
    expect(summary.outstanding).toBe(3000);
    expect(summary.isSettled).toBe(false);
  });

  it("is settled once the full amount is in", () => {
    const summary = paymentSummary(
      [line({ id: "l1" })],
      [payment({ id: "p1", amount: 5000 })]
    );

    expect(summary.outstanding).toBe(0);
    expect(summary.isSettled).toBe(true);
  });

  it("keeps a bond out of what has been received", () => {
    const summary = paymentSummary(
      [line({ id: "l1" })],
      [
        payment({ id: "p1", amount: 5000 }),
        payment({ id: "p2", kind: "Bond", amount: 2000 }),
      ]
    );

    // The bond is owed back, so it settles nothing and is not income.
    expect(summary.received).toBe(5000);
    expect(summary.outstanding).toBe(0);
    expect(summary.bondHeld).toBe(2000);
  });

  it("keeps a refund out of received, and still nets it into what is owed", () => {
    const summary = paymentSummary(
      [line({ id: "l1" })],
      [payment({ id: "p1", amount: 5000 }), payment({ id: "p2", amount: -500 })]
    );

    // Received is what came in, refunded is what went back. Netting them into
    // one number is what made the UI say "-R 500,00 paid".
    expect(summary.received).toBe(5000);
    expect(summary.refunded).toBe(500);
    expect(summary.outstanding).toBe(500);
  });

  it("releases the bond when it is returned as a negative bond row", () => {
    const summary = paymentSummary(
      [line({ id: "l1" })],
      [
        payment({ id: "p1", kind: "Bond", amount: 2000 }),
        payment({ id: "p2", kind: "Bond", amount: -2000 }),
      ]
    );

    expect(summary.bondHeld).toBe(0);
  });

  it("counts a deposit line as part of the price, not on top of it", () => {
    const summary = paymentSummary(
      [line({ id: "l1" }), line({ id: "l2", kind: "Deposit", unit_price: 1000 })],
      [payment({ id: "p1", amount: 1000 })]
    );

    // The deposit is part of the 5000, so paying it leaves 4000 owing.
    expect(summary.charged).toBe(5000);
    expect(summary.outstanding).toBe(4000);
  });

  it("reports an overpayment as a negative balance rather than clamping it", () => {
    const summary = paymentSummary(
      [line({ id: "l1" })],
      [payment({ id: "p1", amount: 6000 })]
    );

    expect(summary.outstanding).toBe(-1000);
    expect(summary.isSettled).toBe(true);
  });

  it("adds to the cent without float dust", () => {
    const summary = paymentSummary(
      [line({ id: "l1", unit_price: 0.3 })],
      [payment({ id: "p1", amount: 0.1 }), payment({ id: "p2", amount: 0.2 })]
    );

    expect(summary.received).toBe(0.3);
    expect(summary.outstanding).toBe(0);
  });
});
