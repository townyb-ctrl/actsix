import { bookingCoversDay, type VenueBooking } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";

export type HireToday = {
  hire: VenueHire;
  bookings: VenueBooking[];
  /** Earliest start today, used to order the list. */
  startsAt: string;
};

/**
 * The hires actually happening on a given day, earliest first.
 *
 * Cancelled bookings are ignored, and a hire whose bookings are all cancelled
 * drops off the day entirely - it is not happening, so nobody should be
 * standing in a foyer expecting it.
 */
export const hiresToday = (
  hires: VenueHire[],
  bookings: VenueBooking[],
  day: Date
): HireToday[] =>
  hires
    .map((hire) => {
      const mine = bookings
        .filter(
          (booking) =>
            booking.hire_id === hire.id &&
            booking.status !== "Cancelled" &&
            bookingCoversDay(booking, day)
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

      if (mine.length === 0) return null;

      return { hire, bookings: mine, startsAt: mine[0].starts_at };
    })
    .filter((entry): entry is HireToday => entry !== null)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

/** Run sheet items that touch this day, in the order they happen. */
export const itemsForDay = (items: VenueRunSheetItem[], day: Date): VenueRunSheetItem[] =>
  items
    .filter((item) => bookingCoversDay(item, day))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.sort_order - b.sort_order);

/**
 * What is happening right now and what is next.
 *
 * `current` is anything already started and not yet finished - there can be
 * more than one across different rooms. `next` is the soonest thing that has
 * not started. Both are null outside the event, which is the honest answer at
 * 3am rather than pretending the first item of the day is imminent.
 */
export const nowAndNext = (
  items: VenueRunSheetItem[],
  now: Date
): { current: VenueRunSheetItem[]; next: VenueRunSheetItem | null } => {
  const at = now.getTime();

  const current = items.filter(
    (item) => new Date(item.starts_at).getTime() <= at && new Date(item.ends_at).getTime() > at
  );

  const upcoming = items
    .filter((item) => new Date(item.starts_at).getTime() > at)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return { current, next: upcoming[0] ?? null };
};
