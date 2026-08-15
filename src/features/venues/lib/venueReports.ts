import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueEnquiry, VenueEnquiryStatus } from "@/features/venues/lib/venueEnquiries";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import type { VenuePayment } from "@/features/venues/lib/venuePayments";
import { quoteTotals, type VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

export type DateWindow = {
  /** Inclusive ISO instant. */
  from: string;
  /** Exclusive ISO instant, so two adjacent windows never double-count a booking. */
  to: string;
};

const withinWindow = (iso: string, window: DateWindow) => {
  const at = new Date(iso).getTime();
  return at >= new Date(window.from).getTime() && at < new Date(window.to).getTime();
};

export type FunnelStage = {
  status: VenueEnquiryStatus;
  count: number;
};

export type EnquiryFunnel = {
  stages: FunnelStage[];
  total: number;
  accepted: number;
  declined: number;
  /** Accepted as a share of everything decided. Undecided enquiries are excluded. */
  conversionRate: number;
};

/**
 * Where enquiries got to.
 *
 * The conversion rate deliberately ignores enquiries still in flight: counting
 * them as failures makes a busy month look like a bad one, purely because the
 * work has not been done yet.
 */
export const enquiryFunnel = (
  enquiries: VenueEnquiry[],
  statuses: VenueEnquiryStatus[]
): EnquiryFunnel => {
  const stages = statuses.map((status) => ({
    status,
    count: enquiries.filter((enquiry) => enquiry.status === status).length,
  }));

  const accepted = enquiries.filter((enquiry) => enquiry.status === "Accepted").length;
  const declined = enquiries.filter((enquiry) => enquiry.status === "Declined").length;
  const decided = accepted + declined;

  return {
    stages,
    total: enquiries.length,
    accepted,
    declined,
    conversionRate: decided === 0 ? 0 : accepted / decided,
  };
};

export type SpaceUtilisation = {
  spaceId: string;
  name: string;
  /** Hours booked inside the window, to one decimal. */
  hours: number;
  bookings: number;
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * How hard each room is worked.
 *
 * A booking that straddles the edge of the window is clipped to it rather than
 * counted whole or dropped, so a month's figure is the hours actually inside
 * that month. Cancelled bookings never count - nobody was in the room.
 */
export const spaceUtilisation = (
  bookings: VenueBooking[],
  spaces: VenueSpace[],
  window: DateWindow
): SpaceUtilisation[] => {
  const windowStart = new Date(window.from).getTime();
  const windowEnd = new Date(window.to).getTime();

  return spaces
    .map((space) => {
      const mine = bookings.filter(
        (booking) => booking.space_id === space.id && booking.status !== "Cancelled"
      );

      let ms = 0;
      let counted = 0;

      for (const booking of mine) {
        const start = Math.max(new Date(booking.starts_at).getTime(), windowStart);
        const end = Math.min(new Date(booking.ends_at).getTime(), windowEnd);
        if (end <= start) continue;

        ms += end - start;
        counted += 1;
      }

      return {
        spaceId: space.id,
        name: space.name,
        hours: Math.round((ms / HOUR_MS) * 10) / 10,
        bookings: counted,
      };
    })
    .sort((a, b) => b.hours - a.hours);
};

export type EventTypeRevenue = {
  eventType: string;
  quoted: number;
  received: number;
  hires: number;
};

const UNTYPED = "Not categorised";

/**
 * What each kind of event is worth.
 *
 * Both numbers are reported because they answer different questions: quoted is
 * what the church agreed to charge, received is what actually arrived. A gap
 * between them is the point of showing both.
 *
 * Bond money is excluded on both sides - it is held, not earned.
 */
export const revenueByEventType = (
  hires: VenueHire[],
  lines: VenueQuoteLine[],
  payments: VenuePayment[]
): EventTypeRevenue[] => {
  const totals = new Map<string, EventTypeRevenue>();

  for (const hire of hires) {
    const eventType = hire.event_type.trim() || UNTYPED;
    const entry =
      totals.get(eventType) || { eventType, quoted: 0, received: 0, hires: 0 };

    const hireLines = lines.filter((line) => line.hire_id === hire.id);
    const hirePayments = payments.filter(
      (payment) => payment.hire_id === hire.id && payment.kind !== "Bond"
    );

    entry.quoted += quoteTotals(hireLines).charges;
    entry.received += hirePayments.reduce((sum, payment) => sum + payment.amount, 0);
    entry.hires += 1;

    totals.set(eventType, entry);
  }

  return [...totals.values()]
    .map((entry) => ({
      ...entry,
      quoted: Math.round(entry.quoted * 100) / 100,
      received: Math.round(entry.received * 100) / 100,
    }))
    .sort((a, b) => b.received - a.received || b.quoted - a.quoted);
};

export type RepeatHirer = {
  /** As typed on the most recent hire, which is the spelling worth showing. */
  name: string;
  hires: number;
  lastHireAt: string;
};

/**
 * Who keeps coming back.
 *
 * Grouped on a case- and space-insensitive name because "Grace Ministries" and
 * "grace ministries " are one hirer to everybody except a string comparison.
 * A contact id would be better and is used when both hires have one; free-typed
 * names are all that exists for the rest.
 */
export const repeatHirers = (hires: VenueHire[]): RepeatHirer[] => {
  const groups = new Map<string, { name: string; hires: number; lastHireAt: string }>();

  for (const hire of hires) {
    const typed = hire.hirer_name.trim();
    if (!typed) continue;

    const key = hire.hirer_contact_id || typed.toLowerCase().replace(/\s+/g, " ");
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, { name: typed, hires: 1, lastHireAt: hire.created_at });
      continue;
    }

    existing.hires += 1;
    if (hire.created_at > existing.lastHireAt) {
      existing.lastHireAt = hire.created_at;
      existing.name = typed;
    }
  }

  return [...groups.values()]
    .filter((entry) => entry.hires > 1)
    .sort((a, b) => b.hires - a.hires || b.lastHireAt.localeCompare(a.lastHireAt));
};

/** Enquiries and hires that fall inside the window, by when they came in. */
export const withinReportWindow = <T extends { created_at: string }>(
  rows: T[],
  window: DateWindow
): T[] => rows.filter((row) => withinWindow(row.created_at, window));

/** The last `months` whole months up to and including today. */
export const monthsWindow = (months: number, now = new Date()): DateWindow => {
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return { from: from.toISOString(), to: to.toISOString() };
};
