import {
  formatCurrency,
  type VenueBooking,
  type VenueSpace,
} from "@/features/venues/lib/venueBookings";
import {
  spaceColor,
  DEFAULT_SPACE_COLOR,
} from "@/features/venues/lib/venueSpaceColors";
import {
  findClashes,
  type ChurchEvent,
} from "@/features/venues/lib/venueClashes";
import { hireSpan, type VenueHire } from "@/features/venues/lib/venueHires";
import {
  paymentSummary,
  type VenuePayment,
} from "@/features/venues/lib/venuePayments";
import {
  unfilledTotal,
  type VenuePosition,
  type VenuePositionAssignment,
} from "@/features/venues/lib/venuePositions";
import {
  turnaroundProgress,
  type VenueTurnaroundTask,
} from "@/features/venues/lib/venueTurnaround";
import type { VenueHireContact } from "@/features/venues/lib/venueSafety";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

/**
 * The desk is ordered by when, never by record type. A band is how close the
 * thing is to needing a person, and it is the only sort key that survives a
 * Thursday afternoon: "on now" beats "expensive", always.
 */
export type DeskBand = "now" | "today" | "week" | "ahead" | "closing";

/**
 * Band names say enough on their own; only the two that could be misread carry
 * a gloss. Five bands each explaining themselves is instructional chrome on a
 * screen for somebody who already knows what a week is.
 */
export const DESK_BANDS: { id: DeskBand; name: string; blurb: string }[] = [
  { id: "now", name: "On now", blurb: "" },
  { id: "today", name: "Today", blurb: "" },
  { id: "week", name: "This week", blurb: "" },
  {
    id: "ahead",
    name: "Ahead",
    blurb: "Not for weeks, already wanting something",
  },
  { id: "closing", name: "Closing out", blurb: "Over, and not finished with" },
];

export type DeskSignal = {
  id: string;
  band: DeskBand;
  /** What wants a person, said the way somebody would say it out loud. */
  title: string;
  hireId: string;
  hireName: string;
  /** When the hire it concerns runs. Null when the hire has no dates yet. */
  at: string | null;
  /** The one number or word that sits in the right-hand column. */
  fact: string;
  /**
   * `hot` when leaving it costs money, safety or a bond argument; `warm` when
   * it only slips. Never the only signal - the row says what it is in words.
   */
  weight: "hot" | "warm";
};

export type DeskHireInput = {
  hire: VenueHire;
  bookings: VenueBooking[];
  lines: VenueQuoteLine[];
  payments: VenuePayment[];
  positions: VenuePosition[];
  assignments: VenuePositionAssignment[];
  turnaround: VenueTurnaroundTask[];
  contacts: VenueHireContact[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** `YYYY-MM-DD` from local parts. See `StripDay.dateKey` for why not ISO. */
export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

/**
 * Which band a hire sits in, from its own dates rather than its status field.
 * A "Confirmed" hire that finished in March is closing out, whatever the badge
 * on it says, and a coordinator reading the desk needs the calendar's answer.
 */
export const bandForSpan = (
  span: { startsAt: string; endsAt: string } | null,
  now: Date,
): DeskBand => {
  if (!span) return "ahead";

  const startsAt = new Date(span.startsAt).getTime();
  const endsAt = new Date(span.endsAt).getTime();
  const at = now.getTime();

  if (endsAt < at) return "closing";
  if (startsAt <= at) return "now";

  const todayEnds = startOfDay(now).getTime() + DAY_MS;
  if (startsAt < todayEnds) return "today";
  if (startsAt < todayEnds + 6 * DAY_MS) return "week";
  return "ahead";
};

/**
 * Everything across every hire that wants a person, in the order a week
 * actually arrives.
 *
 * Every entry has to name a consequence somebody would recognise. A signal that
 * merely reports state ("quote is a draft", "3 positions exist") gets read once
 * and ignored forever, which is how a badge stops meaning anything.
 */
export const deskSignals = (
  entries: DeskHireInput[],
  churchEvents: ChurchEvent[],
  now: Date = new Date(),
): DeskSignal[] => {
  const signals: DeskSignal[] = [];
  const at = now.getTime();

  for (const entry of entries) {
    const {
      hire,
      bookings,
      lines,
      payments,
      positions,
      assignments,
      turnaround,
      contacts,
    } = entry;
    if (hire.status === "Cancelled") continue;

    const live = bookings.filter((booking) => booking.status !== "Cancelled");
    const span = hireSpan(live);
    const band = bandForSpan(span, now);
    const ended = Boolean(span && new Date(span.endsAt).getTime() < at);
    const imminent = band === "now" || band === "today" || band === "week";

    const push = (
      key: string,
      title: string,
      fact: string,
      weight: DeskSignal["weight"],
    ) =>
      signals.push({
        id: `${hire.id}:${key}`,
        band,
        title,
        hireId: hire.id,
        hireName: hire.name,
        at: span?.startsAt ?? null,
        fact,
        weight,
      });

    if (live.length === 0) {
      push("unbooked", "No dates held yet", "0 bookings", "warm");
    }

    const clashes = findClashes(live, churchEvents).clashes;
    if (clashes.length > 0) {
      push(
        "clash",
        "Double-booked against the church diary",
        `${clashes.length} clash${clashes.length === 1 ? "" : "es"}`,
        "hot",
      );
    }

    if (hire.quote_status === "Draft" && lines.length > 0) {
      push(
        "quote",
        "Quote written but never sent",
        `${lines.length} lines`,
        "warm",
      );
    }

    if (hire.quote_status === "Draft" && hire.contract_signed_on) {
      push(
        "contract",
        "Contract signed against a draft quote",
        "unpriced",
        "hot",
      );
    }

    const owed = paymentSummary(lines, payments).outstanding;
    if (hire.quote_status !== "Declined" && owed > 0) {
      push(
        "owed",
        ended ? "Still owed, and the event is over" : "Not paid yet",
        // The product's one money format. Two spellings of the same amount in
        // one viewport reads as two different numbers.
        formatCurrency(owed),
        ended ? "hot" : "warm",
      );
    }

    const unfilled = unfilledTotal(positions, assignments);
    if (unfilled > 0) {
      push(
        "positions",
        imminent ? "Nobody on these positions yet" : "Positions still to fill",
        `${unfilled} to fill`,
        imminent ? "hot" : "warm",
      );
    }

    if (imminent && hire.security_required && !hire.security_provider.trim()) {
      push("security", "Security needed, nobody booked", "no provider", "hot");
    }

    if (imminent && contacts.length === 0 && !hire.onsite_contact_name.trim()) {
      push("contact", "Nobody to phone on the day", "no contact", "hot");
    }

    const turn = turnaroundProgress(turnaround);
    if (ended && turn.total > turn.done) {
      push(
        "turnaround",
        "Building not turned around",
        `${turn.total - turn.done} left`,
        "hot",
      );
    }

    if (
      ended &&
      span &&
      new Date(span.endsAt).getTime() < at - 7 * DAY_MS &&
      !hire.debrief_completed_on
    ) {
      push("debrief", "Never debriefed", "not written", "warm");
    }
  }

  const bandOrder = DESK_BANDS.map((band) => band.id);

  return signals.sort((a, b) => {
    const byBand = bandOrder.indexOf(a.band) - bandOrder.indexOf(b.band);
    if (byBand !== 0) return byBand;
    if (a.weight !== b.weight) return a.weight === "hot" ? -1 : 1;
    if (a.at && b.at && a.at !== b.at) return a.at.localeCompare(b.at);
    return a.hireName.localeCompare(b.hireName);
  });
};

export type StripEntry = {
  id: string;
  kind: "hire" | "church";
  title: string;
  hireId: string | null;
  /** Sorted on, so a room keeps the same lane across every day it is held. */
  spaceId: string | null;
  color: string;
  startsAt: string;
  endsAt: string;
  /** False on the day it starts; true on every day it runs through. */
  continues: boolean;
};

export type StripDay = {
  iso: string;
  /**
   * `YYYY-MM-DD` in local time. Never derive this from `toISOString()`: these
   * days are local midnights, and UTC drags them onto the previous date
   * everywhere east of Greenwich, so a link to Wednesday opened Tuesday.
   */
  dateKey: string;
  weekday: string;
  dayOfMonth: number;
  /** Set only where the month changes, so the strip labels itself once. */
  monthLabel: string | null;
  isToday: boolean;
  isWeekend: boolean;
  /**
   * One slot per lane across the whole window, `null` where that lane is free
   * on this day. Fixed-length and index-stable, so a bar keeps its height on
   * every day it runs and the continuation join always meets the right bar.
   */
  lanes: (StripEntry | null)[];
  /** The lanes actually in use, for anything that just wants to count. */
  entries: StripEntry[];
};

/** A hire or church event visible somewhere in the window, for the roll. */
export type StripOccupant = {
  key: string;
  kind: "hire" | "church";
  title: string;
  hireId: string | null;
  color: string;
  startsAt: string;
  endsAt: string;
};

export type BuildingStrip = {
  days: StripDay[];
  /**
   * What the bars are, named. Fourteen columns leave no room for a label, and a
   * `title` tooltip is dead on touch - so the strip says *when* and this says
   * *what*, one row each.
   */
  roll: StripOccupant[];
};

/**
 * The building's next `days` days, today first.
 *
 * Hires and the church's own diary are drawn in the same strip on purpose: the
 * question a coordinator is really asking is "is the building free", and an
 * answer that only counts paid hires has lied by omission.
 */
export const buildingStrip = ({
  days,
  bookings,
  spaces,
  events,
  hires = [],
  from = new Date(),
}: {
  days: number;
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  events: ChurchEvent[];
  /** Only for naming the roll: a bar belongs to a hire, not to a booking title. */
  hires?: VenueHire[];
  from?: Date;
}): BuildingStrip => {
  const hireName = (hireId: string | null) =>
    hireId ? (hires.find((hire) => hire.id === hireId)?.name ?? null) : null;
  const first = startOfDay(from);
  const windowStart = first.getTime();
  const windowEnd = windowStart + days * DAY_MS;
  const colorOf = (spaceId: string | null) =>
    spaceColor(spaces.find((space) => space.id === spaceId)?.color) ||
    DEFAULT_SPACE_COLOR;

  /**
   * Same half-open interval as `bookingCoversDay`, against a camelCase shape.
   * Written out rather than reusing that helper because it reads `starts_at`
   * off its argument, and handing it this shape silently matched nothing.
   */
  const coversDay = (
    item: { startsAt: string; endsAt: string },
    dayStart: number,
  ) =>
    new Date(item.startsAt).getTime() < dayStart + DAY_MS &&
    new Date(item.endsAt).getTime() > dayStart;

  type Occupancy = {
    lane: string;
    id: string;
    kind: "hire" | "church";
    title: string;
    hireId: string | null;
    spaceId: string | null;
    color: string;
    startsAt: string;
    endsAt: string;
  };

  const occupancies: Occupancy[] = [];

  for (const booking of bookings) {
    if (booking.status === "Cancelled") continue;
    if (new Date(booking.starts_at).getTime() >= windowEnd) continue;
    if (new Date(booking.ends_at).getTime() <= windowStart) continue;
    occupancies.push({
      // A lane belongs to a room, not to a booking: two consecutive bookings of
      // the same hall are one horizontal run to the eye, and splitting them
      // across lanes is what made a hire look like unrelated marks.
      lane: `space:${booking.space_id ?? "none"}`,
      id: booking.id,
      kind: "hire",
      title: booking.title || "Booking",
      hireId: booking.hire_id,
      spaceId: booking.space_id,
      color: colorOf(booking.space_id),
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
    });
  }

  for (const event of events) {
    if (event.status === "Cancelled") continue;
    if (new Date(event.starts_at).getTime() >= windowEnd) continue;
    if (new Date(event.ends_at).getTime() <= windowStart) continue;
    occupancies.push({
      // The church's own diary keeps one lane at the bottom whatever room it
      // names, so the hires above it never shuffle when a prayer meeting lands.
      lane: "church",
      id: event.id,
      kind: "church",
      title: event.title || "Church diary",
      hireId: null,
      spaceId: event.space_id,
      color: DEFAULT_SPACE_COLOR,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
    });
  }

  // Lane order is decided once for the whole window, from the first moment each
  // lane is occupied, then held for every column. Deciding it per day is what
  // let a bar jump rows the moment a one-off booking appeared beside it.
  const laneFirstSeen = new Map<string, string>();
  for (const item of occupancies) {
    const seen = laneFirstSeen.get(item.lane);
    if (!seen || item.startsAt < seen)
      laneFirstSeen.set(item.lane, item.startsAt);
  }

  const laneOrder = [...laneFirstSeen.entries()]
    .sort((a, b) => {
      if (a[0] === "church") return 1;
      if (b[0] === "church") return -1;
      return a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]);
    })
    .map(([lane]) => lane);

  const laneIndex = new Map(laneOrder.map((lane, index) => [lane, index]));

  const stripDays = Array.from({ length: days }, (_, index) => {
    const day = new Date(first.getTime() + index * DAY_MS);
    const dayStart = day.getTime();

    const lanes: (StripEntry | null)[] = laneOrder.map(() => null);

    for (const item of occupancies) {
      if (!coversDay(item, dayStart)) continue;
      const slot = laneIndex.get(item.lane);
      if (slot === undefined) continue;

      const entry: StripEntry = {
        id: item.id,
        kind: item.kind,
        title: item.title,
        hireId: item.hireId,
        spaceId: item.spaceId,
        color: item.color,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        continues: new Date(item.startsAt).getTime() < dayStart,
      };

      // Two bookings of one room on one day: the earlier one owns the lane, and
      // the later one is already visible on the roll below the strip.
      const held = lanes[slot];
      if (!held || entry.startsAt < held.startsAt) lanes[slot] = entry;
    }

    const previous =
      index === 0 ? null : new Date(first.getTime() + (index - 1) * DAY_MS);
    const weekday = day.getDay();

    return {
      iso: day.toISOString(),
      dateKey: localDateKey(day),
      weekday: day.toLocaleDateString("en-ZA", { weekday: "narrow" }),
      dayOfMonth: day.getDate(),
      monthLabel:
        !previous || previous.getMonth() !== day.getMonth()
          ? day.toLocaleDateString("en-ZA", { month: "short" })
          : null,
      isToday: index === 0,
      isWeekend: weekday === 0 || weekday === 6,
      lanes,
      entries: lanes.filter((entry): entry is StripEntry => entry !== null),
    };
  });

  // The roll collapses a hire's several bookings into one row: somebody reading
  // it wants to know the championships have the building, not that they hold
  // four separate slots in it.
  const rolled = new Map<string, StripOccupant>();
  for (const item of occupancies) {
    const key = item.hireId ? `hire:${item.hireId}` : `${item.kind}:${item.id}`;
    const held = rolled.get(key);

    if (!held) {
      rolled.set(key, {
        key,
        kind: item.kind,
        title: hireName(item.hireId) ?? item.title,
        hireId: item.hireId,
        color: item.color,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
      });
      continue;
    }

    if (item.startsAt < held.startsAt) held.startsAt = item.startsAt;
    if (item.endsAt > held.endsAt) held.endsAt = item.endsAt;
  }

  return {
    days: stripDays,
    roll: [...rolled.values()].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    ),
  };
};
