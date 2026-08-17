import type { VenueBooking } from "@/features/venues/lib/venueBookings";
import type { VenueQuoteStatus } from "@/features/venues/lib/venueQuotes";

export type VenueHireStatus = "Draft" | "Confirmed" | "Completed" | "Cancelled";

export type VenueHire = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  event_type: string;
  hirer_contact_id: string | null;
  hirer_name: string;
  hirer_email: string;
  hirer_phone: string;
  /** Whoever is on site on the day, often not the person who booked. */
  onsite_contact_name: string;
  onsite_contact_phone: string;
  status: VenueHireStatus;
  quote_status: VenueQuoteStatus;
  quote_sent_at: string | null;
  payment_terms: string;
  /** Copied from the workspace's standard clauses, then editable per hire. */
  contract_clauses: string;
  contract_signed_on: string | null;
  contract_signed_by: string;
  enquiry_id: string | null;
  /** What to do differently next time, carried into a repeat hire. */
  lessons_learned: string;
  debrief_notes: string;
  debrief_completed_on: string | null;
  /** 1-5, null until somebody judges it. */
  hirer_rating: number | null;
  /** Null until somebody answers. */
  would_host_again: boolean | null;
  damage_found: string;
  damage_cost: number;
  /** Bearer token for the hirer's page. Null until a link is created. */
  portal_token: string | null;
  portal_enabled: boolean;
  security_required: boolean;
  security_provider: string;
  security_from: string | null;
  security_to: string | null;
  car_guards_required: boolean;
  car_guard_count: number;
  access_plan: string;
  av_preset_id: string | null;
  walkie_channels: string;
  /** Staff only. Never leaves the workspace. */
  notes: string;
  /** Shown to the hirer on their portal page. */
  hirer_notes: string;
  created_at: string;
  updated_at: string;
};

export const VENUE_HIRE_STATUSES: VenueHireStatus[] = [
  "Draft",
  "Confirmed",
  "Completed",
  "Cancelled",
];

export type HireSpan = {
  startsAt: string;
  endsAt: string;
  /** Calendar days touched, including any gap day nothing is booked on. */
  dayCount: number;
};

const startOfDay = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a hire runs, derived from its bookings rather than stored on the hire.
 * Storing it would need updating on every booking edit and would drift the
 * first time one was missed.
 *
 * Cancelled bookings are excluded - they no longer occupy the building, so a
 * cancelled Sunday must not stretch the hire across the weekend.
 */
export const hireSpan = (bookings: VenueBooking[]): HireSpan | null => {
  const active = bookings.filter((booking) => booking.status !== "Cancelled");
  if (active.length === 0) return null;

  const startsAt = active.reduce(
    (earliest, booking) => (booking.starts_at < earliest ? booking.starts_at : earliest),
    active[0].starts_at
  );
  const endsAt = active.reduce(
    (latest, booking) => (booking.ends_at > latest ? booking.ends_at : latest),
    active[0].ends_at
  );

  // Counted in local calendar days so a hire reads the way a coordinator counts
  // it: Wednesday to Saturday is four days, however many hours that spans.
  const dayCount = Math.round((startOfDay(endsAt) - startOfDay(startsAt)) / DAY_MS) + 1;

  return { startsAt, endsAt, dayCount };
};

export type HireDay = {
  /** Local calendar day, as YYYY-MM-DD. */
  day: string;
  bookings: VenueBooking[];
};

const localDayKey = (iso: string) => {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Bookings grouped under the day they start, chronologically. Cancelled ones
 * are kept: the coordinator needs to see that Saturday was called off, not
 * find Saturday silently missing.
 */
export const bookingsByDay = (bookings: VenueBooking[]): HireDay[] => {
  const days = new Map<string, VenueBooking[]>();

  for (const booking of [...bookings].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const key = localDayKey(booking.starts_at);
    days.set(key, [...(days.get(key) ?? []), booking]);
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayBookings]) => ({ day, bookings: dayBookings }));
};
