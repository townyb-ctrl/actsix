import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <section className="st-panel" aria-labelledby="hire-days-heading">
      <div className="st-panel-head">
        <h2 className="st-panel-title" id="hire-days-heading">
          Spaces &amp; days
        </h2>

        <div className="flex items-center gap-2">
          <span className="st-tally">{bookings.length}</span>
          <Button size="sm" variant="ghost" className="min-h-9" onClick={onAddBooking}>
            <Plus className="h-4 w-4" />
            Add a space or day
          </Button>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing booked yet. Add the spaces and days this hire needs: setup, the event itself, and
          pack-down are usually separate.
        </p>
      ) : (
        days.map(({ day, bookings: dayBookings }) => (
          <div key={day}>
            {/* The day is a header on the list, not a card around it - one
                divider per group, and the times below stay in one column. */}
            <div className="flex items-center justify-between border-t border-[--st-line-soft] bg-[--st-panel-hi] px-4 py-2">
              <h3 className="label-eyebrow">{formatDayHeading(day)}</h3>
              <span className="st-tally">{dayBookings.length}</span>
            </div>

            {dayBookings.map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => onEditBooking(booking)}
                className="action-row flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{booking.title}</span>
                    {booking.status === "Cancelled" && <Badge variant="outline">Cancelled</Badge>}
                    {booking.status === "Pending" && <Badge variant="secondary">Pending</Badge>}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {spaceName(booking.space_id)}
                  </span>
                </span>

                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatTime(booking.starts_at)}–{formatTime(booking.ends_at)}
                </span>

                {booking.booking_type === "external" && booking.quoted_fee > 0 && (
                  <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums">
                    {formatCurrency(booking.quoted_fee)}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
