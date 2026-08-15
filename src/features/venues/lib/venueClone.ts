import type { VenueBooking } from "@/features/venues/lib/venueBookings";
import type { VenuePosition } from "@/features/venues/lib/venuePositions";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";

/**
 * Days between the first booked day and the day the repeat should start on.
 * Whole local days: a hire that ran Fri-Sun still runs Fri-Sun, not Fri-Sun
 * shifted by however many hours a naive millisecond difference produced.
 */
const dayOffset = (fromIso: string, toDay: string): number => {
  const from = new Date(fromIso);
  const [year, month, day] = toDay.split("-").map(Number);

  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toMidnight = new Date(year, month - 1, day).getTime();

  return Math.round((toMidnight - fromMidnight) / (24 * 60 * 60 * 1000));
};

/**
 * The same wall-clock time, `days` later. Built from local calendar parts
 * rather than by adding milliseconds, so a 09:00 start stays 09:00 even if a
 * clock change falls between the two dates.
 */
const shiftIso = (iso: string, days: number): string => {
  const source = new Date(iso);
  const shifted = new Date(
    source.getFullYear(),
    source.getMonth(),
    source.getDate() + days,
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds()
  );
  return shifted.toISOString();
};

export type ClonedBooking = Pick<
  VenueBooking,
  "space_id" | "title" | "booking_type" | "starts_at" | "ends_at" | "notes"
>;

export type ClonedQuoteLine = Pick<
  VenueQuoteLine,
  "kind" | "description" | "quantity" | "unit_price" | "sort_order" | "notes"
>;

export type ClonedRunSheetItem = Pick<
  VenueRunSheetItem,
  | "space_id"
  | "title"
  | "starts_at"
  | "ends_at"
  | "setup_notes"
  | "av_notes"
  | "access_notes"
  | "risk_notes"
  | "sort_order"
>;

export type ClonedPosition = Pick<VenuePosition, "role_id" | "starts_at" | "ends_at" | "needed" | "notes">;

export type ClonePlan = {
  offsetDays: number;
  bookings: ClonedBooking[];
  lines: ClonedQuoteLine[];
  runSheetItems: ClonedRunSheetItem[];
  positions: ClonedPosition[];
};

export type CloneSource = {
  bookings: VenueBooking[];
  lines: VenueQuoteLine[];
  runSheetItems: VenueRunSheetItem[];
  positions: VenuePosition[];
};

/**
 * What a repeat of this hire would look like, starting on `startDay`.
 *
 * Everything that describes the shape of the event is copied: the rooms and
 * times, the price, the run sheet, and how many people each position needs.
 *
 * Everything that describes what happened to *this* hire is not - payments,
 * signatures, the debrief, and who was rostered. Those belong to the event that
 * already ran. Positions are copied without their assignments precisely because
 * "we need two ushers" repeats and "Sipho did it last year" does not.
 *
 * Cancelled bookings are dropped: the repeat wants what the event actually was.
 */
export const planClone = (source: CloneSource, startDay: string): ClonePlan => {
  const liveBookings = source.bookings.filter((booking) => booking.status !== "Cancelled");

  const earliest = liveBookings.reduce(
    (soFar: string | null, booking) =>
      soFar === null || booking.starts_at < soFar ? booking.starts_at : soFar,
    null
  );

  const offsetDays = earliest === null ? 0 : dayOffset(earliest, startDay);

  return {
    offsetDays,
    bookings: liveBookings.map((booking) => ({
      space_id: booking.space_id,
      title: booking.title,
      booking_type: booking.booking_type,
      starts_at: shiftIso(booking.starts_at, offsetDays),
      ends_at: shiftIso(booking.ends_at, offsetDays),
      notes: booking.notes,
    })),
    lines: source.lines.map((line) => ({
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      sort_order: line.sort_order,
      notes: line.notes,
    })),
    runSheetItems: source.runSheetItems.map((item) => ({
      space_id: item.space_id,
      title: item.title,
      starts_at: shiftIso(item.starts_at, offsetDays),
      ends_at: shiftIso(item.ends_at, offsetDays),
      setup_notes: item.setup_notes,
      av_notes: item.av_notes,
      access_notes: item.access_notes,
      risk_notes: item.risk_notes,
      sort_order: item.sort_order,
    })),
    positions: source.positions.map((position) => ({
      role_id: position.role_id,
      starts_at: shiftIso(position.starts_at, offsetDays),
      ends_at: shiftIso(position.ends_at, offsetDays),
      needed: position.needed,
      notes: position.notes,
    })),
  };
};
