export type VenueBookingStatus = "Pending" | "Confirmed" | "Cancelled";
export type VenueBookingType = "internal" | "external";
export type VenuePaymentStatus = "Not applicable" | "Unpaid" | "Deposit paid" | "Paid";
export type VenueBookingSource = "staff" | "public";

export type VenueSpace = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  description: string;
  capacity: number | null;
  hourly_rate: number;
  daily_rate: number;
  color: string;
  photo_urls: string[];
  standing_capacity: number | null;
  seated_capacity: number | null;
  floor_plan_url: string | null;
  /** False for a space that only makes sense hired alongside another. */
  hireable_standalone: boolean;
  setup_minutes: number;
  packdown_minutes: number;
  food_allowed: boolean;
  /** Staff-only areas that get closed off during a hire rather than hired out. */
  is_restricted_zone: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueBooking = {
  id: string;
  workspace_id: string;
  user_id: string;
  space_id: string;
  title: string;
  booking_type: VenueBookingType;
  hirer_contact_id: string | null;
  hirer_name: string;
  hirer_email: string;
  hirer_phone: string;
  starts_at: string;
  ends_at: string;
  status: VenueBookingStatus;
  quoted_fee: number;
  deposit_amount: number;
  payment_status: VenuePaymentStatus;
  source: VenueBookingSource;
  requested_features: string[];
  needs_technician: boolean;
  technician_fee: number;
  coffee_requested: boolean;
  coffee_fee: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ConflictCandidate = {
  /** Present when editing - the booking never conflicts with itself. */
  id?: string;
  spaceId: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Bookings on the same space whose time ranges overlap the candidate.
 * Ranges are half-open: a booking ending at 12:00 does not conflict with one
 * starting at 12:00, because back-to-back hires are routine, not a mistake.
 * Overlaps are surfaced as a warning - the caller decides whether to proceed.
 */
export const findConflicts = (
  candidate: ConflictCandidate,
  existing: VenueBooking[]
): VenueBooking[] => {
  const candidateStart = new Date(candidate.startsAt).getTime();
  const candidateEnd = new Date(candidate.endsAt).getTime();

  return existing.filter((booking) => {
    if (booking.id === candidate.id) return false;
    if (booking.space_id !== candidate.spaceId) return false;
    if (booking.status === "Cancelled") return false;

    return (
      new Date(booking.starts_at).getTime() < candidateEnd &&
      new Date(booking.ends_at).getTime() > candidateStart
    );
  });
};

/**
 * True when a booking's interval touches the given calendar day at all - a
 * multi-day booking must appear on every day it covers, not only the day it
 * starts. Uses the same half-open interval as findConflicts: a booking ending
 * at midnight does not spill onto the next day.
 */
export const bookingCoversDay = (
  booking: Pick<VenueBooking, "starts_at" | "ends_at">,
  day: Date
): boolean => {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const start = new Date(booking.starts_at).getTime();
  const end = new Date(booking.ends_at).getTime();

  return start < dayEnd && end > dayStart;
};

export const formatBookingRange = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  const time = (value: Date) =>
    value.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return `${date}, ${time(start)}–${time(end)}`;

  const endDate = end.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  return `${date} ${time(start)} – ${endDate} ${time(end)}`;
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount || 0);
