import { formatCurrency, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";
import { findClashes, type ChurchEvent } from "@/features/venues/lib/venueClashes";
import { isDebriefStarted } from "@/features/venues/lib/venueDebrief";
import { hireSpan, type VenueHire } from "@/features/venues/lib/venueHires";
import { paymentSummary, type VenuePayment } from "@/features/venues/lib/venuePayments";
import {
  unfilledTotal,
  type VenuePosition,
  type VenuePositionAssignment,
} from "@/features/venues/lib/venuePositions";
import { quoteTotals, type VenueQuoteLine } from "@/features/venues/lib/venueQuotes";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
import {
  incidentSummary,
  safetyGaps,
  type VenueHireContact,
  type VenueIncident,
} from "@/features/venues/lib/venueSafety";
import {
  checkoutSummary,
  printRunSize,
  signPlan,
  type VenueHireSign,
  type VenueResourceCheckout,
  type VenueSign,
} from "@/features/venues/lib/venueSignage";
import {
  turnaroundProgress,
  walkthroughCoverage,
  type VenueTurnaroundTask,
  type VenueWalkthrough,
} from "@/features/venues/lib/venueTurnaround";

/**
 * Every concern a hire carries, in the order the hire's own life runs.
 *
 * These are the panels. Naming them here rather than in the page is what lets
 * one function decide, for all of them, whether something still wants a person -
 * so the page can put the answer first instead of filing it behind a tab.
 */
export type HireConcernId =
  | "dates"
  | "clashes"
  | "quote"
  | "payments"
  | "contract"
  | "portal"
  | "runsheet"
  | "positions"
  | "safety"
  | "signage"
  | "walkthrough"
  | "turnaround"
  | "debrief"
  | "notes";

export type HireConcern = {
  id: HireConcernId;
  name: string;
  /**
   * Where this stands, in one line, shown whether the panel is open or shut.
   * A folded concern that does not say its own answer has only moved the
   * reading; it has not saved any.
   */
  status: string;
  /**
   * `hot` when leaving it costs money, safety or a bond argument; `warm` when it
   * only slips; `null` when nobody needs to do anything. Never the only signal -
   * the row says what it is in words.
   */
  attention: "hot" | "warm" | null;
  /** The feed behind it dropped, so "settled" would be a guess, not a fact. */
  failed: boolean;
};

export type HireBoardInput = {
  hire: VenueHire;
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  churchEvents: ChurchEvent[];
  lines: VenueQuoteLine[];
  payments: VenuePayment[];
  runSheetItems: VenueRunSheetItem[];
  positions: VenuePosition[];
  assignments: VenuePositionAssignment[];
  incidents: VenueIncident[];
  contacts: VenueHireContact[];
  signs: VenueSign[];
  signLinks: VenueHireSign[];
  checkouts: VenueResourceCheckout[];
  walkthroughs: VenueWalkthrough[];
  turnaround: VenueTurnaroundTask[];
  /** Concerns whose feed failed. They can never be reported as settled. */
  failed?: Partial<Record<HireConcernId, boolean>>;
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A stored date is `YYYY-MM-DD`; nobody reads a hire in ISO. */
const readableDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Inside a week, or already running. The point where "later" stops working. */
const IMMINENT_MS = 7 * DAY_MS;

export const hireBoard = ({
  hire,
  bookings,
  spaces,
  churchEvents,
  lines,
  payments,
  runSheetItems,
  positions,
  assignments,
  incidents,
  contacts,
  signs,
  signLinks,
  checkouts,
  walkthroughs,
  turnaround,
  failed = {},
  now = new Date(),
}: HireBoardInput): HireConcern[] => {
  const at = now.getTime();
  const live = bookings.filter((booking) => booking.status !== "Cancelled");
  const span = hireSpan(live);

  const ended = Boolean(span && new Date(span.endsAt).getTime() < at);
  const running = Boolean(
    span && new Date(span.startsAt).getTime() <= at && new Date(span.endsAt).getTime() >= at
  );
  const imminent =
    running || Boolean(span && new Date(span.startsAt).getTime() - at < IMMINENT_MS && !ended);

  const spaceNames = [
    ...new Set(
      live
        .map((booking) => spaces.find((space) => space.id === booking.space_id)?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];

  const concerns: HireConcern[] = [];

  const add = (
    id: HireConcernId,
    name: string,
    attention: HireConcern["attention"],
    status: string
  ) => {
    const broke = Boolean(failed[id]);
    concerns.push({
      id,
      name,
      // A dropped feed reads as an empty list everywhere else in this module,
      // and an empty list is indistinguishable from good news. So a broken feed
      // is never settled, and it says so rather than reporting a total.
      attention: broke ? "warm" : attention,
      status: broke ? "could not be loaded" : status,
      failed: broke,
    });
  };

  // ---- The days ---------------------------------------------------------
  add(
    "dates",
    "Days & spaces",
    live.length === 0 ? "hot" : null,
    live.length === 0
      ? "nothing booked"
      : `${span?.dayCount ?? 0} ${span?.dayCount === 1 ? "day" : "days"}${
          spaceNames.length > 0 ? ` · ${spaceNames.join(", ")}` : ""
        }`
  );

  const clashes = findClashes(live, churchEvents);
  add(
    "clashes",
    "Church diary",
    clashes.clashes.length > 0 ? "hot" : clashes.uncheckedCount > 0 ? "warm" : null,
    clashes.clashes.length > 0
      ? `${clashes.clashes.length} clash${clashes.clashes.length === 1 ? "" : "es"}`
      : clashes.uncheckedCount > 0
        ? `${clashes.uncheckedCount} diary events carry no space`
        : "no clashes"
  );

  // ---- The money --------------------------------------------------------
  const totals = quoteTotals(lines);
  // An empty quote on a hire six months out is not a failure, it is the normal
  // state of a hire nobody has priced yet. It only wants a person once the date
  // is close or somebody has already said yes.
  const shouldBePriced = imminent || hire.status === "Confirmed";
  add(
    "quote",
    "Quote",
    lines.length === 0
      ? shouldBePriced
        ? "warm"
        : null
      : hire.quote_status === "Draft"
        ? "warm"
        : null,
    lines.length === 0
      ? "nothing quoted"
      : hire.quote_status === "Draft"
        ? `written, never sent · ${formatCurrency(totals.charges)}`
        : `${hire.quote_status.toLowerCase()} · ${formatCurrency(totals.charges)}`
  );

  const money = paymentSummary(lines, payments);
  const owed = hire.quote_status !== "Declined" && money.outstanding > 0;
  add(
    "payments",
    "Payments",
    owed ? (ended ? "hot" : "warm") : money.outstanding < 0 ? "hot" : null,
    owed
      ? `${formatCurrency(money.outstanding)} outstanding`
      : money.outstanding < 0
        ? `overpaid by ${formatCurrency(Math.abs(money.outstanding))}`
        : money.bondHeld > 0
          ? `settled · ${formatCurrency(money.bondHeld)} bond held`
          : "settled"
  );

  // A contract signed against a draft quote means somebody agreed to something
  // nobody priced. That is a contradiction, not a status pair.
  const signedAgainstDraft = hire.quote_status === "Draft" && Boolean(hire.contract_signed_on);
  const unsignedButConfirmed = hire.status === "Confirmed" && !hire.contract_signed_on;
  add(
    "contract",
    "Contract",
    signedAgainstDraft ? "hot" : unsignedButConfirmed ? "warm" : null,
    signedAgainstDraft
      ? "signed against a draft quote"
      : hire.contract_signed_on
        ? `signed ${readableDate(hire.contract_signed_on)}${
            hire.contract_signed_by ? ` · ${hire.contract_signed_by}` : ""
          }`
        : "not signed"
  );

  add("portal", "Hirer link", null, hire.portal_enabled ? "on" : "off");

  // ---- The plan ---------------------------------------------------------
  add(
    "runsheet",
    "Run sheet",
    imminent && runSheetItems.length === 0 ? "warm" : null,
    runSheetItems.length === 0
      ? "nothing scheduled"
      : `${runSheetItems.length} ${runSheetItems.length === 1 ? "item" : "items"}`
  );

  const unfilled = unfilledTotal(positions, assignments);
  add(
    "positions",
    "Positions",
    unfilled > 0 ? (imminent ? "hot" : "warm") : imminent && positions.length === 0 ? "warm" : null,
    unfilled > 0
      ? `${unfilled} still to fill`
      : positions.length === 0
        ? "nobody rostered"
        : "fully staffed"
  );

  // ---- On the day -------------------------------------------------------
  const openIncidents = incidentSummary(incidents).open;
  const gaps = safetyGaps(hire, contacts);
  add(
    "safety",
    "Safety & security",
    openIncidents > 0 ? "hot" : gaps.length > 0 ? (imminent ? "hot" : "warm") : null,
    openIncidents > 0
      ? `${openIncidents} open incident${openIncidents === 1 ? "" : "s"}`
      : gaps.length > 0
        ? gaps[0].toLowerCase()
        : "nothing outstanding"
  );

  const plan = signPlan(signLinks, signs);
  const toPrint = printRunSize(plan);
  const kit = checkoutSummary(checkouts);
  add(
    "signage",
    "Signage, AV & kit",
    kit.anythingOut && ended ? "hot" : toPrint > 0 && imminent ? "warm" : null,
    kit.anythingOut && ended
      ? `${kit.out} still signed out`
      : toPrint > 0
        ? `${toPrint} to print`
        : plan.length === 0
          ? "no signs chosen"
          : `${plan.length} signs ready`
  );

  // ---- Afterwards -------------------------------------------------------
  // A missing walkthrough only becomes somebody's problem once the hire is
  // over: before that there is nothing to have walked yet. After it, the bond
  // argument can no longer be won.
  const coverage = walkthroughCoverage(walkthroughs);
  add(
    "walkthrough",
    "Condition walkthrough",
    ended && !coverage.bothEndsCaptured
      ? "hot"
      : imminent && coverage.before.length === 0
        ? "warm"
        : null,
    coverage.bothEndsCaptured
      ? `both ends · ${coverage.photoCount} ${coverage.photoCount === 1 ? "photo" : "photos"}`
      : coverage.before.length === 0 && coverage.after.length === 0
        ? "nothing recorded"
        : "only one end recorded"
  );

  const turn = turnaroundProgress(turnaround);
  add(
    "turnaround",
    "Cleaning & turnaround",
    ended && turn.total > turn.done ? "hot" : null,
    turn.total === 0
      ? "nothing listed"
      : turn.allDone
        ? "done"
        : `${turn.total - turn.done} of ${turn.total} left`
  );

  const longOver = Boolean(span && new Date(span.endsAt).getTime() < at - 7 * DAY_MS);
  add(
    "debrief",
    "After the event",
    longOver && !hire.debrief_completed_on ? "warm" : null,
    hire.debrief_completed_on
      ? `written ${readableDate(hire.debrief_completed_on)}`
      : isDebriefStarted(hire)
        ? "started"
        : "not written"
  );

  const noteCount = (hire.notes.trim() ? 1 : 0) + (hire.hirer_notes.trim() ? 1 : 0);
  add(
    "notes",
    "Notes",
    null,
    noteCount === 0 ? "none" : noteCount === 1 ? "1 note" : "2 notes"
  );

  return concerns;
};

/** The ones wanting a person, hottest first, otherwise in the hire's own order. */
export const openConcerns = (board: HireConcern[]): HireConcern[] =>
  board
    .filter((concern) => concern.attention !== null)
    .sort((a, b) => (a.attention === b.attention ? 0 : a.attention === "hot" ? -1 : 1));

/** Everything nobody has to touch, left in the hire's own order. */
export const settledConcerns = (board: HireConcern[]): HireConcern[] =>
  board.filter((concern) => concern.attention === null);

/**
 * Whether a hire still wants somebody, and whether it stopped while they were
 * looking at it.
 *
 * The hire detail page marks the moment the last concern goes quiet, and that
 * mark is only honest for the person who did the settling. A hire that was
 * already in hand when they opened it has had nothing finished on it, and
 * congratulating them on arrival would spend the moment on every page load
 * until it stopped meaning anything.
 *
 * Latched rather than recomputed, so a re-render between the two states - or
 * StrictMode's double one - cannot swallow the transition it is watching for.
 * `newVisit()` starts it over; the caller owes it one per hire.
 */
export type ClearingLatch = { wanted: boolean; clearedThisVisit: boolean };

export const newVisit = (): ClearingLatch => ({ wanted: false, clearedThisVisit: false });

export const clearingLatch = (previous: ClearingLatch, stillWanting: number): ClearingLatch => {
  if (stillWanting > 0 && !previous.wanted) return { wanted: true, clearedThisVisit: false };
  if (stillWanting === 0 && previous.wanted) return { wanted: false, clearedThisVisit: true };
  return previous;
};
