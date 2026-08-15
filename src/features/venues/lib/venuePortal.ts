import { quoteTotals, type VenueQuoteLineKind } from "@/features/venues/lib/venueQuotes";

/** The shape get_venue_hire_portal returns. Deliberately narrower than a hire. */
export type PortalPayload = {
  hire: {
    name: string;
    event_type: string;
    status: string;
    quote_status: "Draft" | "Sent" | "Accepted" | "Declined";
    payment_terms: string;
    contract_clauses: string;
    contract_signed_on: string | null;
    contract_signed_by: string;
    hirer_name: string;
  };
  workspace: { name: string } | null;
  bookings: {
    title: string;
    starts_at: string;
    ends_at: string;
    status: string;
    space_name: string | null;
  }[];
  quote_lines: {
    kind: VenueQuoteLineKind;
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  payments: {
    kind: "Payment" | "Bond";
    amount: number;
    paid_on: string;
    method: string;
  }[];
};

export type PortalBalance = {
  charged: number;
  received: number;
  outstanding: number;
  dueNow: number;
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * What the hirer owes, worked out from the same rules staff see.
 *
 * Bond payments are excluded from `received` for the same reason as everywhere
 * else: the money is held, not earned, and counting it would tell a hirer they
 * had paid when they had not.
 */
export const portalBalance = (payload: PortalPayload): PortalBalance => {
  const totals = quoteTotals(
    payload.quote_lines.map((line, index) => ({
      id: String(index),
      workspace_id: "",
      hire_id: "",
      user_id: "",
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      sort_order: index,
      notes: "",
      created_at: "",
      updated_at: "",
    }))
  );

  const receivedCents = payload.payments
    .filter((payment) => payment.kind !== "Bond")
    .reduce((sum, payment) => sum + toCents(payment.amount), 0);

  const chargedCents = toCents(totals.charges);

  return {
    charged: totals.charges,
    received: fromCents(receivedCents),
    outstanding: fromCents(chargedCents - receivedCents),
    dueNow: totals.dueNow,
  };
};

/** True when the portal should offer accept/decline rather than just show the quote. */
export const awaitingAnswer = (payload: PortalPayload) =>
  payload.hire.quote_status === "Sent";
