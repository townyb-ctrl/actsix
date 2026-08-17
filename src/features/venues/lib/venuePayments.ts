import { quoteTotals, type VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

export type VenuePaymentKind = "Payment" | "Bond";
export type VenuePaymentMethod = "EFT" | "Cash" | "Card" | "Other";

export type VenuePayment = {
  id: string;
  workspace_id: string;
  hire_id: string;
  user_id: string;
  kind: VenuePaymentKind;
  /** Signed: a refund or a returned bond is a negative row of the same kind. */
  amount: number;
  paid_on: string;
  method: VenuePaymentMethod;
  reference: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export const VENUE_PAYMENT_METHODS: VenuePaymentMethod[] = ["EFT", "Cash", "Card", "Other"];

export type PaymentSummary = {
  /** What the quote says the hire costs. */
  charged: number;
  /** What has actually come in against that, refunds already deducted. */
  received: number;
  /** Still owed. Negative means they have overpaid. */
  outstanding: number;
  /**
   * Money that went back to the hirer, as a positive number. Refunds are
   * recorded as negative payments, and netting them into `received` produced
   * "-R 600,00 paid" on every surface that reads this - which looks like a data
   * fault rather than a refund.
   */
  refunded: number;
  /** Bond money held, which is owed back and is never income. */
  bondHeld: number;
  isSettled: boolean;
};

/** Cents, not floats - a balance shown to a hirer must not carry binary dust. */
const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * Where a hire stands financially.
 *
 * A bond is deliberately kept out of `received`: it is held against damage and
 * owed back, so counting it would make a hire look paid when it is not. A
 * deposit is the opposite - it is part of the price, already inside the quote's
 * charge total, so paying it simply reduces what is outstanding.
 *
 * Overpayment surfaces as a negative `outstanding` rather than being clamped to
 * zero, because someone has to notice and refund it.
 */
export const paymentSummary = (
  lines: VenueQuoteLine[],
  payments: VenuePayment[]
): PaymentSummary => {
  const chargedCents = toCents(quoteTotals(lines).charges);

  let receivedCents = 0;
  let refundedCents = 0;
  let bondCents = 0;

  for (const payment of payments) {
    if (payment.kind === "Bond") {
      bondCents += toCents(payment.amount);
      continue;
    }

    const cents = toCents(payment.amount);
    if (cents < 0) {
      refundedCents += -cents;
      continue;
    }
    receivedCents += cents;
  }

  // What is owed still nets the two: a refund puts money back on the bill.
  const outstandingCents = chargedCents - receivedCents + refundedCents;

  return {
    charged: fromCents(chargedCents),
    received: fromCents(receivedCents),
    refunded: fromCents(refundedCents),
    outstanding: fromCents(outstandingCents),
    bondHeld: fromCents(bondCents),
    isSettled: outstandingCents <= 0,
  };
};
