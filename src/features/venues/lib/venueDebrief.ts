import { paymentSummary, type VenuePayment } from "@/features/venues/lib/venuePayments";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

export type HireOutcome = {
  /** What the quote said the hire costs. */
  charged: number;
  /** What actually arrived. */
  received: number;
  /** What went back to the hirer, as a positive number. */
  refunded: number;
  /** Still owed. Negative means they overpaid and are owed money back. */
  outstanding: number;
  /** Bond money still held, before any damage is taken out of it. */
  bondHeld: number;
  /** What repairs cost. */
  damageCost: number;
  /** What of the bond goes back to the hirer once damage is covered. */
  bondToReturn: number;
  /**
   * Damage the bond did not cover. The church absorbs this unless somebody
   * invoices for it, so it is shown rather than quietly netted off.
   */
  unrecoveredDamage: number;
  /** Money kept: what came in, less what the damage cost to repair. */
  net: number;
};

/** Cents, not floats - this ends up next to a bond a hirer is owed. */
const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * How a hire finished, financially.
 *
 * Damage comes out of the bond first, which is what the bond is for. Anything
 * left over goes back to the hirer; anything the bond does not stretch to is
 * surfaced as `unrecoveredDamage` rather than being hidden in the net, because
 * somebody has to decide whether to chase it.
 *
 * Bond money is never counted as income - `net` is what was kept: receipts,
 * less anything refunded, less the repair cost.
 */
export const hireOutcome = (
  lines: VenueQuoteLine[],
  payments: VenuePayment[],
  damageCost: number
): HireOutcome => {
  const money = paymentSummary(lines, payments);

  const bondCents = toCents(money.bondHeld);
  const damageCents = Math.max(0, toCents(damageCost));

  const bondToReturnCents = Math.max(0, bondCents - damageCents);
  const unrecoveredCents = Math.max(0, damageCents - bondCents);

  return {
    charged: money.charged,
    received: money.received,
    refunded: money.refunded,
    outstanding: money.outstanding,
    bondHeld: money.bondHeld,
    damageCost: fromCents(damageCents),
    bondToReturn: fromCents(bondToReturnCents),
    unrecoveredDamage: fromCents(unrecoveredCents),
    net: fromCents(toCents(money.received) - toCents(money.refunded) - damageCents),
  };
};

export type DebriefFields = {
  debrief_notes: string;
  debrief_completed_on: string | null;
  hirer_rating: number | null;
  would_host_again: boolean | null;
  damage_found: string;
  damage_cost: number;
  lessons_learned: string;
};

/**
 * True once somebody has actually answered something. Used to show a hire as
 * still needing a debrief - a completed date alone is not enough, because it is
 * set by the same save that writes the answers.
 */
export const isDebriefStarted = (fields: Partial<DebriefFields>): boolean =>
  Boolean(
    fields.debrief_completed_on ||
      fields.hirer_rating ||
      fields.would_host_again !== null && fields.would_host_again !== undefined ||
      (fields.debrief_notes || "").trim() ||
      (fields.damage_found || "").trim() ||
      (fields.lessons_learned || "").trim()
  );
