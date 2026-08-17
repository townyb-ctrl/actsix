import { useState } from "react";

import { formatCurrency, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";
import {
  SLOT_BANDS,
  dayFromKey,
  formatHour,
  formatSlotLabel,
  slotCost,
  slotsForSpace,
  spanFromSlots,
} from "@/features/venues/lib/venueSlots";

type Props = {
  spaces: VenueSpace[];
  bookings: VenueBooking[];
  days: string[];
  activeDay: string;
  onDayChange: (key: string) => void;
  /** The span being built, as the modal holds it. */
  selection: { spaceId: string; startsAt: string; endsAt: string } | null;
  onPick: (spaceId: string, startsAt: Date, endsAt: Date) => void;
  excludeBookingId?: string | null;
};

const formatDayChip = (key: string) => {
  const date = dayFromKey(key);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) return "Today";
  return date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
};

/**
 * Which room, which hours, against what is already booked.
 *
 * The form this replaces asked for a space and two datetime fields, then told
 * you afterwards that you had picked an hour somebody else already had. Here
 * the taken hours are simply not offered, so the clash cannot be made in the
 * first place - the check that follows is a backstop rather than the first time
 * anybody hears about it.
 */
export default function VenueSlotPicker({
  spaces,
  bookings,
  days,
  activeDay,
  onDayChange,
  selection,
  onPick,
  excludeBookingId,
}: Props) {
  /** The first of the two clicks that make a span, if one is pending. */
  const [anchor, setAnchor] = useState<{ spaceId: string; hour: number } | null>(null);

  const pick = (spaceId: string, hour: number) => {
    if (anchor && anchor.spaceId === spaceId) {
      const span = spanFromSlots(activeDay, anchor.hour, hour);
      setAnchor(null);
      onPick(spaceId, span.startsAt, span.endsAt);
      return;
    }

    // A first click books its own hour outright, so one click is a valid
    // booking and the second is only ever an extension.
    const span = spanFromSlots(activeDay, hour, hour);
    setAnchor({ spaceId, hour });
    onPick(spaceId, span.startsAt, span.endsAt);
  };

  const selectedHours =
    selection && selection.startsAt && selection.endsAt
      ? Math.max(
          0,
          Math.round(
            (new Date(selection.endsAt).getTime() - new Date(selection.startsAt).getTime()) / 3600000
          )
        )
      : 0;

  const selectedSpace = spaces.find((space) => space.id === selection?.spaceId);
  const cost = selectedSpace
    ? slotCost({
        hourlyRate: selectedSpace.hourly_rate,
        dailyRate: selectedSpace.daily_rate,
        hours: selectedHours,
      })
    : 0;

  return (
    <div className="space-y-3">
      <div className="actsix-filter-pills" role="group" aria-label="Day">
        {days.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === activeDay}
            className={`actsix-filter-pill ${
              key === activeDay ? "actsix-filter-pill-active" : "actsix-filter-pill-idle"
            }`}
            onClick={() => {
              setAnchor(null);
              onDayChange(key);
            }}
          >
            {formatDayChip(key)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px] space-y-3">
          {spaces.map((space) => {
            const slots = slotsForSpace({
              spaceId: space.id,
              key: activeDay,
              bookings,
              excludeBookingId,
              selection,
            });

            return (
              <div key={space.id} className="st-panel">
                <div className="st-panel-head">
                  <h3 className="st-panel-title">{space.name}</h3>
                  <span className="st-tally">
                    {space.hourly_rate > 0 ? `${formatCurrency(space.hourly_rate)}/hr` : "no rate"}
                  </span>
                </div>

                <div className="space-y-1.5 px-3 py-3">
                  {SLOT_BANDS.map((band) => (
                    <div key={band.name} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-[0.17em] text-muted-foreground">
                        {band.name}
                      </span>

                      <div className="flex flex-wrap gap-1">
                        {slots
                          .filter((slot) => slot.hour >= band.from && slot.hour < band.to)
                          .map((slot) => {
                            const taken = Boolean(slot.takenBy);

                            return (
                              <button
                                key={slot.hour}
                                type="button"
                                disabled={taken}
                                onClick={() => pick(space.id, slot.hour)}
                                aria-pressed={slot.selected}
                                aria-label={
                                  taken
                                    ? `${formatSlotLabel(slot.hour)} in ${space.name}, taken by ${slot.takenBy?.title}`
                                    : `${formatSlotLabel(slot.hour)} in ${space.name}`
                                }
                                title={taken ? slot.takenBy?.title : undefined}
                                className={[
                                  "min-h-9 rounded-[var(--radius-control)] border px-2.5 font-mono text-xs tabular-nums transition",
                                  taken
                                    ? "cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground/70 line-through"
                                    : slot.selected
                                      ? "border-brand-teal bg-brand-teal text-white"
                                      : "border-border/70 bg-background hover:border-brand-teal",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40",
                                ].join(" ")}
                              >
                                {formatHour(slot.hour)}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {selectedSpace && selectedHours > 0 ? (
          <>
            <span className="font-semibold text-foreground">
              {selectedSpace.name}, {selectedHours} {selectedHours === 1 ? "hour" : "hours"}
            </span>
            {cost > 0 && (
              <>
                {" · "}
                <span className="font-mono tabular-nums">{formatCurrency(cost)}</span> at the
                standard rate, before anything is quoted
              </>
            )}
            {anchor && " · pick a second hour to extend"}
          </>
        ) : (
          "Pick an hour to start, then another to extend it. Struck-through hours are already booked."
        )}
      </p>
    </div>
  );
}
