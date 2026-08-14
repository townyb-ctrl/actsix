import type { VenueBooking } from "@/features/venues/lib/venueBookings";

/**
 * A row from `calendar_events`, narrowed to what a clash check needs.
 * `space_id` is null for every event entered before slice 9, and for any event
 * whose author did not pick a space - those are counted, not checked.
 */
export type ChurchEvent = {
  id: string;
  title: string;
  calendar_name: string;
  space_id: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: "Tentative" | "Confirmed" | "Cancelled";
};

export type VenueClash = {
  booking: VenueBooking;
  event: ChurchEvent;
};

export type ClashReport = {
  clashes: VenueClash[];
  /**
   * Events overlapping the hire that carry no space, so they could not be
   * checked. Surfaced so the panel can admit the gap instead of reading as
   * "all clear".
   */
  uncheckedCount: number;
};

const overlaps = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean =>
  new Date(aStart).getTime() < new Date(bEnd).getTime() &&
  new Date(aEnd).getTime() > new Date(bStart).getTime();

/**
 * Where this hire's bookings collide with the church's own diary.
 *
 * Same half-open interval as `findConflicts`: an event ending at 12:00 does not
 * clash with a booking starting at 12:00, because back-to-back use of a room is
 * normal. Cancelled bookings and cancelled events are ignored - neither is
 * occupying the building. A tentative event still clashes: "we might need the
 * hall" is exactly what someone quoting a hire needs to see.
 *
 * An all-day event is treated as occupying its whole stored range, which is
 * what the calendar module already writes for one.
 */
export const findClashes = (
  bookings: VenueBooking[],
  events: ChurchEvent[]
): ClashReport => {
  const liveBookings = bookings.filter((booking) => booking.status !== "Cancelled");
  const liveEvents = events.filter((event) => event.status !== "Cancelled");

  const clashes: VenueClash[] = [];
  let uncheckedCount = 0;

  for (const event of liveEvents) {
    const touchesHire = liveBookings.some((booking) =>
      overlaps(booking.starts_at, booking.ends_at, event.starts_at, event.ends_at)
    );
    if (!touchesHire) continue;

    if (!event.space_id) {
      uncheckedCount += 1;
      continue;
    }

    for (const booking of liveBookings) {
      if (booking.space_id !== event.space_id) continue;
      if (!overlaps(booking.starts_at, booking.ends_at, event.starts_at, event.ends_at)) {
        continue;
      }
      clashes.push({ booking, event });
    }
  }

  clashes.sort(
    (a, b) =>
      new Date(a.booking.starts_at).getTime() - new Date(b.booking.starts_at).getTime()
  );

  return { clashes, uncheckedCount };
};
