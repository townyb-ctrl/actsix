import { AlertTriangle, CalendarCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";
import { findClashes, type ChurchEvent } from "@/features/venues/lib/venueClashes";

type Props = {
  bookings: VenueBooking[];
  events: ChurchEvent[];
  spaces: VenueSpace[];
  loading: boolean;
  /** Nothing booked yet, so there is nothing to check against. */
  hasSpan: boolean;
};

const formatRange = (startsAt: string, endsAt: string, allDay: boolean) => {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (allDay) return `${date} · all day`;

  const time = (value: Date) =>
    value.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time(start)}–${time(new Date(endsAt))}`;
};

export default function VenueClashPanel({
  bookings,
  events,
  spaces,
  loading,
  hasSpan,
}: Props) {
  const { clashes, uncheckedCount } = findClashes(bookings, events);
  const spaceName = (spaceId: string | null) =>
    spaces.find((space) => space.id === spaceId)?.name || "Unknown space";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Church diary</CardTitle>
        {!loading && hasSpan && (
          <Badge variant={clashes.length > 0 ? "destructive" : "secondary"}>
            {clashes.length === 0
              ? "No clashes"
              : `${clashes.length} ${clashes.length === 1 ? "clash" : "clashes"}`}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking the church diary…</p>
        ) : !hasSpan ? (
          <p className="text-sm text-muted-foreground">
            Add a day to this hire and its dates get checked against the church diary.
          </p>
        ) : clashes.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage" />
            Nothing in the church diary wants these spaces at these times.
          </p>
        ) : (
          <ul className="space-y-2">
            {clashes.map((clash) => (
              <li
                key={`${clash.booking.id}-${clash.event.id}`}
                className="flex items-start gap-2 rounded-[var(--radius-control)] border border-brand-danger/25 bg-brand-danger/5 p-2.5 text-sm"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-danger" />
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {spaceName(clash.booking.space_id)} · {clash.event.title}
                    {clash.event.status === "Tentative" && (
                      <span className="text-muted-foreground"> (tentative)</span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {formatRange(
                      clash.event.starts_at,
                      clash.event.ends_at,
                      clash.event.all_day
                    )}{" "}
                    · clashes with “{clash.booking.title}”
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && hasSpan && uncheckedCount > 0 && (
          <p className="border-t pt-3 text-xs text-muted-foreground">
            {uncheckedCount} other{" "}
            {uncheckedCount === 1 ? "diary entry falls" : "diary entries fall"} in these dates
            without naming a space, so {uncheckedCount === 1 ? "it was" : "they were"} not
            checked. Set a space on the event in Calendar to include{" "}
            {uncheckedCount === 1 ? "it" : "them"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
