import { Plus, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";
import { runSheetByDay, type VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";

type Props = {
  items: VenueRunSheetItem[];
  spaces: VenueSpace[];
  onAddItem: (dayIso?: string) => void;
  onEditItem: (item: VenueRunSheetItem) => void;
  onPrint: () => void;
};

const formatDayHeading = (day: string) => {
  // Split rather than new Date("YYYY-MM-DD"), which parses as UTC and can slip a day.
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The three note fields, folded into one line. On a run sheet somebody is
 * holding while the doors open, four stacked labelled lines per slot is a wall;
 * the detail that matters is what to do, and it opens on click.
 */
const notesSummary = (item: VenueRunSheetItem) =>
  [
    item.setup_notes && `Setup: ${item.setup_notes}`,
    item.av_notes && `AV: ${item.av_notes}`,
    item.access_notes && `Access: ${item.access_notes}`,
  ]
    .filter(Boolean)
    .join(" · ");

export default function VenueRunSheetPanel({
  items,
  spaces,
  onAddItem,
  onEditItem,
  onPrint,
}: Props) {
  const days = runSheetByDay(items);
  const spaceName = (spaceId: string | null) =>
    spaceId ? spaces.find((space) => space.id === spaceId)?.name || "Unknown space" : "Whole venue";

  return (
    <section className="st-panel" aria-labelledby="run-sheet-heading">
      <div className="st-panel-head">
        <h2 className="st-panel-title" id="run-sheet-heading">
          Run sheet
        </h2>

        <div className="flex flex-wrap items-center gap-1">
          <span className="st-tally">{items.length}</span>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-9"
            onClick={onPrint}
            disabled={items.length === 0}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button size="sm" variant="ghost" className="min-h-9" onClick={() => onAddItem()}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing on the run sheet yet. Add each slot: setup, registration, the event itself,
          teardown, with what it needs and who can get where.
        </p>
      ) : (
        days.map(({ day, items: dayItems }) => (
          <div key={day}>
            <div className="flex items-center justify-between gap-2 border-t border-[--st-line-soft] bg-[--st-panel-hi] px-4 py-2">
              <h3 className="label-eyebrow">{formatDayHeading(day)}</h3>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-9 px-2 text-xs"
                onClick={() => onAddItem(dayItems[0]?.starts_at)}
              >
                <Plus className="h-3 w-3" />
                Add to this day
              </Button>
            </div>

            {dayItems.map((item) => {
              const notes = notesSummary(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onEditItem(item)}
                  className="action-row flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal/40"
                >
                  {/* Times run down one column: a run sheet is read by scanning
                      the clock, not the titles. */}
                  <span className="w-24 shrink-0 font-mono text-xs tabular-nums">
                    {formatTime(item.starts_at)}
                    <span className="block text-muted-foreground">{formatTime(item.ends_at)}</span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                      <Badge variant="outline" className="font-normal">
                        {spaceName(item.space_id)}
                      </Badge>
                    </span>

                    {notes && (
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {notes}
                      </span>
                    )}
                    {item.risk_notes && (
                      <span className="mt-1 block truncate text-xs font-medium text-brand-danger">
                        {item.risk_notes}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </section>
  );
}
