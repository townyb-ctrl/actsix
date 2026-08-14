import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";
import { bookingsByDay } from "@/features/venues/lib/venueHires";

type Props = {
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  onAddBooking: () => void;
  onEditBooking: (booking: VenueBooking) => void;
};

const formatDayHeading = (day: string) => {
  // day is a local YYYY-MM-DD key; splitting avoids the UTC shift new Date("...")
  // applies to a bare date string.
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

export default function VenueHireDaysPanel({
  bookings,
  spaces,
  onAddBooking,
  onEditBooking,
}: Props) {
  const days = bookingsByDay(bookings);
  const spaceName = (spaceId: string) =>
    spaces.find((space) => space.id === spaceId)?.name || "Unknown space";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Spaces &amp; days</CardTitle>
        <Button size="sm" variant="outline" onClick={onAddBooking}>
          <Plus className="h-4 w-4" />
          Add a space or day
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing booked yet. Add the spaces and days this hire needs — setup, the event itself,
            and pack-down are usually separate.
          </p>
        ) : (
          days.map(({ day, bookings: dayBookings }) => (
            <section key={day} className="space-y-2">
              <h3 className="label-eyebrow">{formatDayHeading(day)}</h3>

              <div className="space-y-2">
                {dayBookings.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onEditBooking(booking)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-[0.75rem] border border-border/70 px-3 py-2 text-left transition hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{booking.title}</p>
                        {booking.status === "Cancelled" && (
                          <Badge variant="outline">Cancelled</Badge>
                        )}
                        {booking.status === "Pending" && <Badge variant="secondary">Pending</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {spaceName(booking.space_id)} · {formatTime(booking.starts_at)}–
                        {formatTime(booking.ends_at)}
                      </p>
                    </div>

                    {booking.booking_type === "external" && booking.quoted_fee > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(booking.quoted_fee)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
