import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-2">
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{booking.title}</p>
                <Badge className={statusClass[booking.status]}>{booking.status}</Badge>
                {booking.source === "public" && <Badge variant="outline">Request</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {spaceName(booking.space_id)} · {formatBookingRange(booking.starts_at, booking.ends_at)}
              </p>
              {booking.booking_type === "external" && (
                <p className="text-sm text-muted-foreground">
                  {booking.hirer_name || "Hirer not named"} · {formatCurrency(booking.quoted_fee)} ·{" "}
                  {booking.payment_status}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(booking)}>
              Open
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
