import type { VenueBooking } from "@/features/venues/lib/venueBookings";

/**
 * The bookable day, in bands.
 *
 * A church hall is not a badminton court: nobody hires 02:00, and a grid that
 * offers all twenty-four hours is mostly dead cells somebody has to scan past.
 * These three cover setup through pack-down and keep the grid to a width that
 * fits a phone.
 */
export const SLOT_BANDS = [
  { name: "Morning", from: 6, to: 12 },
  { name: "Afternoon", from: 12, to: 17 },
  { name: "Evening", from: 17, to: 23 },
] as const;

export const SLOT_HOURS = SLOT_BANDS.flatMap((band) =>
  Array.from({ length: band.to - band.from }, (_, index) => band.from + index)
);

/** Local YYYY-MM-DD. Not toISOString, which shifts the day either side of UTC. */
export const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const dayFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** The hour cell as a real instant, in local time. */
export const slotStart = (key: string, hour: number) => {
  const date = dayFromKey(key);
  date.setHours(hour, 0, 0, 0);
  return date;
};

export const formatHour = (hour: number) => `${`${hour}`.padStart(2, "0")}:00`;

export const formatSlotLabel = (hour: number) => `${formatHour(hour)}–${formatHour(hour + 1)}`;

export type SlotState = {
  hour: number;
  /** A booking already covering this hour, if there is one. */
  takenBy: VenueBooking | null;
  /** Inside the span currently being chosen. */
  selected: boolean;
};

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

/**
 * What every hour of one space on one day is doing.
 *
 * Cancelled bookings free their hour back up: the room is available, and
 * showing it as taken would have somebody phoning to ask why they cannot book a
 * hall that is standing empty.
 */
export const slotsForSpace = ({
  spaceId,
  key,
  bookings,
  excludeBookingId,
  selection,
}: {
  spaceId: string;
  key: string;
  bookings: VenueBooking[];
  /** The booking being edited, which must not clash with itself. */
  excludeBookingId?: string | null;
  selection?: { spaceId: string; startsAt: string; endsAt: string } | null;
}): SlotState[] => {
  const relevant = bookings.filter(
    (booking) =>
      booking.space_id === spaceId &&
      booking.status !== "Cancelled" &&
      booking.id !== excludeBookingId
  );

  const selectionStart =
    selection && selection.spaceId === spaceId ? new Date(selection.startsAt).getTime() : null;
  const selectionEnd =
    selection && selection.spaceId === spaceId ? new Date(selection.endsAt).getTime() : null;

  return SLOT_HOURS.map((hour) => {
    const from = slotStart(key, hour).getTime();
    const to = slotStart(key, hour + 1).getTime();

    const takenBy =
      relevant.find((booking) =>
        overlaps(from, to, new Date(booking.starts_at).getTime(), new Date(booking.ends_at).getTime())
      ) ?? null;

    const selected =
      selectionStart !== null &&
      selectionEnd !== null &&
      overlaps(from, to, selectionStart, selectionEnd);

    return { hour, takenBy, selected };
  });
};

/**
 * The span two clicks describe.
 *
 * Clicking one cell books that hour. Clicking a second extends to cover both,
 * in either order, because somebody picking 16:00 and then noticing they also
 * need 14:00 means the same thing as picking them the other way round.
 */
export const spanFromSlots = (key: string, firstHour: number, secondHour: number) => {
  const from = Math.min(firstHour, secondHour);
  const to = Math.max(firstHour, secondHour) + 1;
  return { startsAt: slotStart(key, from), endsAt: slotStart(key, to) };
};

/**
 * The days offered as chips.
 *
 * A hire that already holds days shows those days and the ones between, since
 * setup, the event and pack-down are the same booking job. Everything else gets
 * the week ahead. The day already chosen is always in the list, or the grid
 * would be showing a day the chips say you are not on.
 */
export const bookableDays = ({
  hireBookings,
  selectedKey,
  today = new Date(),
  span = 7,
}: {
  hireBookings: VenueBooking[];
  selectedKey?: string | null;
  today?: Date;
  span?: number;
}) => {
  const keys = new Set<string>();

  const live = hireBookings.filter((booking) => booking.status !== "Cancelled");

  if (live.length > 0) {
    const times = live.flatMap((booking) => [
      new Date(booking.starts_at).getTime(),
      new Date(booking.ends_at).getTime(),
    ]);
    const first = dayFromKey(dayKey(new Date(Math.min(...times))));
    const last = dayFromKey(dayKey(new Date(Math.max(...times))));

    // A hire that runs a season should not print a season of chips.
    for (let cursor = new Date(first), guard = 0; cursor <= last && guard < 21; guard += 1) {
      keys.add(dayKey(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  } else {
    for (let index = 0; index < span; index += 1) {
      keys.add(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + index)));
    }
  }

  if (selectedKey) keys.add(selectedKey);

  return [...keys].sort();
};

/** What the space's own rate says this span costs, before anybody quotes it. */
export const slotCost = ({
  hourlyRate,
  dailyRate,
  hours,
}: {
  hourlyRate: number;
  dailyRate: number;
  hours: number;
}) => {
  if (hours <= 0) return 0;
  const hourly = hourlyRate * hours;
  // Past the point where the day rate is cheaper, a venue charges the day rate.
  if (dailyRate > 0 && hourly > dailyRate) return dailyRate;
  return hourly;
};
