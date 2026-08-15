import { describe, expect, it } from "vitest";

import { awaitingAnswer, portalBalance, type PortalPayload } from "./venuePortal";

const payload = (overrides: Partial<PortalPayload> = {}): PortalPayload => ({
  hire: {
    name: "Conference",
    event_type: "Conference",
    status: "Confirmed",
    quote_status: "Sent",
    payment_terms: "50% deposit",
    contract_clauses: "No food in the auditorium.",
    contract_signed_on: null,
    contract_signed_by: "",
    hirer_name: "Grace Ministries",
  },
  workspace: { name: "Hope Church" },
  bookings: [],
  quote_lines: [
    { kind: "Venue", description: "Auditorium", quantity: 1, unit_price: 5000 },
    { kind: "Deposit", description: "Deposit", quantity: 1, unit_price: 1000 },
  ],
  payments: [],
  ...overrides,
});

describe("portalBalance", () => {
  it("shows the full charge when nothing is paid", () => {
    const balance = portalBalance(payload());

    expect(balance.charged).toBe(5000);
    expect(balance.received).toBe(0);
    expect(balance.outstanding).toBe(5000);
  });

  it("surfaces the deposit as what secures the date", () => {
    expect(portalBalance(payload()).dueNow).toBe(1000);
  });

  it("counts payments against the balance", () => {
    const balance = portalBalance(
      payload({ payments: [{ kind: "Payment", amount: 1000, paid_on: "2026-09-01", method: "EFT" }] })
    );

    expect(balance.received).toBe(1000);
    expect(balance.outstanding).toBe(4000);
  });

  it("never tells a hirer a bond counts towards what they owe", () => {
    const balance = portalBalance(
      payload({ payments: [{ kind: "Bond", amount: 2000, paid_on: "2026-09-01", method: "EFT" }] })
    );

    expect(balance.received).toBe(0);
    expect(balance.outstanding).toBe(5000);
  });

  it("works to the cent", () => {
    const balance = portalBalance(
      payload({
        quote_lines: [{ kind: "Venue", description: "Hall", quantity: 1, unit_price: 0.3 }],
        payments: [
          { kind: "Payment", amount: 0.1, paid_on: "2026-09-01", method: "EFT" },
          { kind: "Payment", amount: 0.2, paid_on: "2026-09-02", method: "EFT" },
        ],
      })
    );

    expect(balance.outstanding).toBe(0);
  });
});

describe("awaitingAnswer", () => {
  it("asks for an answer only on a quote that was actually sent", () => {
    expect(awaitingAnswer(payload())).toBe(true);
  });

  it("does not reopen a decision already made", () => {
    expect(
      awaitingAnswer(payload({ hire: { ...payload().hire, quote_status: "Accepted" } }))
    ).toBe(false);
    expect(
      awaitingAnswer(payload({ hire: { ...payload().hire, quote_status: "Draft" } }))
    ).toBe(false);
  });
});
