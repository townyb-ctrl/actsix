import { Plus, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const DetailLine = ({ label, value }: { label: string; value: string }) =>
  value ? (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  ) : null;

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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Run sheet</CardTitle>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onPrint} disabled={items.length === 0}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAddItem()}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing on the run sheet yet. Add each slot — setup, registration, the event itself,
            teardown — with what it needs and who can get where.
          </p>
        ) : (
          days.map(({ day, items: dayItems }) => (
            <section key={day} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="label-eyebrow">{formatDayHeading(day)}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => onAddItem(dayItems[0]?.starts_at)}
                >
                  <Plus className="h-3 w-3" />
                  Add to this day
                </Button>
              </div>

              <div className="space-y-2">
                {dayItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onEditItem(item)}
                    className="block w-full space-y-1 rounded-[0.75rem] border border-border/70 px-3 py-2 text-left transition hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatTime(item.starts_at)}–{formatTime(item.ends_at)}
                      </span>
                      <span className="font-medium">{item.title}</span>
                      <Badge variant="outline" className="font-normal">
                        {spaceName(item.space_id)}
                      </Badge>
                    </div>

                    <DetailLine label="Setup" value={item.setup_notes} />
                    <DetailLine label="AV" value={item.av_notes} />
                    <DetailLine label="Access" value={item.access_notes} />
                    {item.risk_notes && (
                      <p className="text-sm text-brand-danger">{item.risk_notes}</p>
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
