import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatBookingRange,
  formatCurrency,
  type VenueBooking,
  type VenueSpace,
} from "@/features/venues/lib/venueBookings";

type Props = {
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  onEdit: (booking: VenueBooking) => void;
};

/**
 * Booking status is a state, not a location or primary action - it borrows
 * the semantic success/warning tokens rather than teal, so it doesn't
 * compete with teal's one meaning ("act here") elsewhere on the page.
 */
const statusClass: Record<VenueBooking["status"], string> = {
  Confirmed: "border-transparent bg-brand-success/12 text-brand-success",
  Pending: "border-transparent bg-brand-warning/14 text-brand-warning",
  Cancelled: "border-border/70 bg-transparent text-muted-foreground",
};

export default function VenueBookingList({ bookings, spaces, onEdit }: Props) {
  const spaceName = (spaceId: string) =>
    spaces.find((space) => space.id === spaceId)?.name || "Unknown space";

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nothing booked for this filter.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="actsix-panel st-list">
      {bookings.map((booking) => (
        <div key={booking.id} className="action-row flex items-center gap-3">
          {/* The row itself opens the booking; the hire link is the one thing
              that goes somewhere else, so it sits outside the button. */}
          <button
            type="button"
            className="min-h-11 min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
            onClick={() => onEdit(booking)}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold">{booking.title}</span>
              <Badge className={statusClass[booking.status]}>{booking.status}</Badge>
              {booking.source === "public" && <Badge variant="outline">Request</Badge>}
            </span>

            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {spaceName(booking.space_id)} ·{" "}
              {formatBookingRange(booking.starts_at, booking.ends_at)}
              {booking.booking_type === "external" &&
                ` · ${booking.hirer_name || "Hirer not named"}`}
            </span>
          </button>

          {booking.booking_type === "external" && (
            <span className="shrink-0 text-right">
              <span className="block font-mono text-xs tabular-nums">
                {formatCurrency(booking.quoted_fee)}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {booking.payment_status}
              </span>
            </span>
          )}

          {booking.hire_id && (
            <Link
              to={`/venues/hires/${booking.hire_id}`}
              className="shrink-0 text-xs font-medium text-brand-teal underline underline-offset-2"
            >
              Part of a hire
            </Link>
          )}
        </div>
      ))}
    </Card>
  );
}
