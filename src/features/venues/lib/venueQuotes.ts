export type VenueQuoteLineKind =
  | "Venue"
  | "Resource"
  | "Staff"
  | "Insurance"
  | "Cleaning"
  | "Damage waiver"
  | "Deposit"
  | "Security bond"
  | "Discount"
  | "Other";

export type VenueQuoteStatus = "Draft" | "Sent" | "Accepted" | "Declined";

export type VenueQuoteLine = {
  id: string;
  workspace_id: string;
  hire_id: string;
  user_id: string;
  kind: VenueQuoteLineKind;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export const VENUE_QUOTE_LINE_KINDS: VenueQuoteLineKind[] = [
  "Venue",
  "Resource",
  "Staff",
  "Insurance",
  "Cleaning",
  "Damage waiver",
  "Deposit",
  "Security bond",
  "Discount",
  "Other",
];

export const VENUE_QUOTE_STATUSES: VenueQuoteStatus[] = ["Draft", "Sent", "Accepted", "Declined"];

/** Money held against the hire rather than charged for it. */
const HELD_KINDS: VenueQuoteLineKind[] = ["Deposit", "Security bond"];

export const isHeldKind = (kind: VenueQuoteLineKind) => HELD_KINDS.includes(kind);

export type QuoteTotals = {
  /** What the hire actually costs, discounts already taken off. */
  charges: number;
  /** Deposit plus bond - taken, but not earned. */
  held: number;
  /** The deposit alone: what secures the date. A bond is refundable, so it is excluded. */
  dueNow: number;
};

/** Cents, not floats - 0.1 + 0.2 must not surface as 0.30000000000000004 on an invoice. */
const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

export const lineTotal = (line: Pick<VenueQuoteLine, "quantity" | "unit_price">) =>
  fromCents(Math.round(line.quantity * toCents(line.unit_price)));

/**
 * What a quote adds up to.
 *
 * Deposits and bonds are kept out of `charges`: adding a deposit to the price
 * would double-count it, since it is part of the price rather than on top of it.
 * A discount always reduces the charges whether it was typed as 750 or -750,
 * because both mean the same thing to whoever entered it.
 */
export const quoteTotals = (lines: VenueQuoteLine[]): QuoteTotals => {
  let chargeCents = 0;
  let heldCents = 0;
  let depositCents = 0;

  for (const line of lines) {
    const cents = Math.round(line.quantity * toCents(line.unit_price));

    if (line.kind === "Discount") {
      chargeCents -= Math.abs(cents);
      continue;
    }

    if (isHeldKind(line.kind)) {
      heldCents += cents;
      if (line.kind === "Deposit") depositCents += cents;
      continue;
    }

    chargeCents += cents;
  }

  return {
    charges: fromCents(chargeCents),
    held: fromCents(heldCents),
    dueNow: fromCents(depositCents),
  };
};
