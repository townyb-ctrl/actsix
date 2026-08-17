import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bookingCoversDay, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";
import { spaceColor } from "@/features/venues/lib/venueSpaceColors";

type Props = {
  visibleMonth: Date;
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  loading: boolean;
  onMonthChange: (month: Date) => void;
  onSelectBooking: (booking: VenueBooking) => void;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS_PER_DAY = 3;

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const chipTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

export default function VenueCalendar({
  visibleMonth,
  bookings,
  spaces,
  loading,
  onMonthChange,
  onSelectBooking,
}: Props) {
  const monthStart = startOfMonth(visibleMonth);

  const gridStart = useMemo(() => {
    const start = new Date(monthStart);
    // getDay(): 0 = Sunday .. 6 = Saturday. Monday-first grid needs the offset
    // back to the most recent Monday, wrapping Sunday around to 6.
    const offsetFromMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offsetFromMonday);
    return start;
  }, [monthStart.getTime()]);

  const days = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        return date;
      }),
    [gridStart.getTime()]
  );

  // Cancelled bookings are never occupying the venue, so - matching Calendar's
  // own treatment - they are excluded here regardless of any list filter
  // upstream that might otherwise include them.
  const activeBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "Cancelled"),
    [bookings]
  );

  const chipColor = (spaceId: string) =>
    spaceColor(spaces.find((space) => space.id === spaceId)?.color);

  const today = new Date();
  const monthLabel = visibleMonth.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="label-eyebrow">Booking calendar</p>
          <h2 className="text-sm font-semibold" aria-live="polite">
            {monthLabel}
            {loading && <span className="ml-2 font-normal text-muted-foreground">Loading…</span>}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous month"
            onClick={() => onMonthChange(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onMonthChange(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next month"
            onClick={() => onMonthChange(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 py-2">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayBookings = activeBookings.filter((booking) => bookingCoversDay(booking, day));
              const visible = dayBookings.slice(0, MAX_CHIPS_PER_DAY);
              const overflow = dayBookings.length - visible.length;
              const muted = day.getMonth() !== visibleMonth.getMonth();
              const isToday = day.toDateString() === today.toDateString();
              const dayKey = day.toISOString().slice(0, 10);

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "min-h-24 border-b border-r p-1.5 last:border-r-0 sm:min-h-28",
                    muted && "bg-muted/20 text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                      isToday && "bg-primary text-primary-foreground"
                    )}
                  >
                    {day.getDate()}
                  </span>

                  <div className="mt-1 space-y-1">
                    {visible.map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => onSelectBooking(booking)}
                        className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-white shadow-sm transition-[filter,transform] duration-100 ease-out hover:brightness-95 active:scale-[0.96] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50 focus-visible:ring-offset-1"
                        style={{ backgroundColor: chipColor(booking.space_id) }}
                        title={`${booking.title} · ${chipTime(booking.starts_at)}`}
                      >
                        {chipTime(booking.starts_at)} {booking.title}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <p className="text-[10px] font-medium text-muted-foreground">+{overflow} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
