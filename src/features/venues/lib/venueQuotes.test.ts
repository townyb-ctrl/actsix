import { describe, expect, it } from "vitest";

import { quoteTotals, type VenueQuoteLine } from "./venueQuotes";

const line = (overrides: Partial<VenueQuoteLine> & { id: string }): VenueQuoteLine => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Venue",
  description: "Auditorium",
  quantity: 1,
  unit_price: 0,
  sort_order: 0,
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

describe("quoteTotals", () => {
  it("multiplies quantity by unit price on every charge line", () => {
    const totals = quoteTotals([
      line({ id: "l1", quantity: 2, unit_price: 4500 }),
      line({ id: "l2", kind: "Resource", quantity: 20, unit_price: 25 }),
    ]);

    expect(totals.charges).toBe(9500);
  });

  it("keeps deposits and bonds out of the charge total", () => {
    const totals = quoteTotals([
      line({ id: "l1", quantity: 1, unit_price: 4500 }),
      line({ id: "l2", kind: "Deposit", quantity: 1, unit_price: 1000 }),
      line({ id: "l3", kind: "Security bond", quantity: 1, unit_price: 2000 }),
    ]);

    expect(totals.charges).toBe(4500);
    expect(totals.held).toBe(3000);
  });

  it("subtracts a discount from the charges", () => {
    const totals = quoteTotals([
      line({ id: "l1", quantity: 1, unit_price: 5000 }),
      line({ id: "l2", kind: "Discount", quantity: 1, unit_price: 750 }),
    ]);

    expect(totals.charges).toBe(4250);
  });

  it("treats a discount entered as a negative the same as a positive one", () => {
    const negative = quoteTotals([
      line({ id: "l1", quantity: 1, unit_price: 5000 }),
      line({ id: "l2", kind: "Discount", quantity: 1, unit_price: -750 }),
    ]);

    expect(negative.charges).toBe(4250);
  });

  it("bills a fractional quantity, so half-day and per-hour lines work", () => {
    expect(quoteTotals([line({ id: "l1", quantity: 2.5, unit_price: 175 })]).charges).toBe(437.5);
  });

  it("rounds to the cent rather than carrying binary float dust", () => {
    const totals = quoteTotals([
      line({ id: "l1", quantity: 3, unit_price: 0.1 }),
      line({ id: "l2", quantity: 1, unit_price: 0.2 }),
    ]);

    expect(totals.charges).toBe(0.5);
  });

  it("counts a zero-quantity line as nothing rather than as its unit price", () => {
    expect(quoteTotals([line({ id: "l1", quantity: 0, unit_price: 900 })]).charges).toBe(0);
  });

  it("is all zeroes for an empty quote", () => {
    expect(quoteTotals([])).toEqual({ charges: 0, held: 0, dueNow: 0 });
  });

  it("reports the deposit as what is due now", () => {
    const totals = quoteTotals([
      line({ id: "l1", quantity: 1, unit_price: 4500 }),
      line({ id: "l2", kind: "Deposit", quantity: 1, unit_price: 1000 }),
      line({ id: "l3", kind: "Security bond", quantity: 1, unit_price: 2000 }),
    ]);

    // The bond is refundable and not part of what they pay to secure the date.
    expect(totals.dueNow).toBe(1000);
  });
});
