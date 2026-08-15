import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";
import { hireSpan, type VenueHire } from "@/features/venues/lib/venueHires";
import { paymentSummary, type VenuePayment } from "@/features/venues/lib/venuePayments";
import { unfilledCount, type VenuePosition, type VenuePositionAssignment } from "@/features/venues/lib/venuePositions";
import { incidentSummary, type VenueIncident } from "@/features/venues/lib/venueSafety";
import { turnaroundProgress, type VenueTurnaroundTask } from "@/features/venues/lib/venueTurnaround";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
import type { VenueHireSectionId } from "@/features/venues/components/VenueHireSectionRail";

type Props = {
  hire: VenueHire;
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  lines: VenueQuoteLine[];
  payments: VenuePayment[];
  runSheetItems: VenueRunSheetItem[];
  positions: VenuePosition[];
  assignments: VenuePositionAssignment[];
  incidents: VenueIncident[];
  turnaroundTasks: VenueTurnaroundTask[];
  onSelect: (id: VenueHireSectionId) => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * One card, and the whole card is the control. A card that is only readable
 * makes somebody hunt back to the rail for the section it just described.
 */
function OverviewCard({
  title,
  section,
  onSelect,
  className,
  children,
}: {
  title: string;
  section: VenueHireSectionId;
  onSelect: (id: VenueHireSectionId) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(section)}
      className={`rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40 active:scale-[0.995] motion-reduce:active:scale-100 ${
        className ?? ""
      }`}
    >
      <Card className="h-full transition hover:border-brand-teal/40">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent className="space-y-1 text-sm">{children}</CardContent>
      </Card>
    </button>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground">{children}</p>
);

/**
 * Where a hire is up to, one card per rail section.
 *
 * Nothing here is fetched or calculated that the sections do not already know -
 * the helpers below are the same pure functions their panels call. The cards
 * carry no actions on purpose: an action needs exactly one place it happens in,
 * or the two places drift.
 */
export default function VenueHireOverviewPanel({
  hire,
  bookings,
  spaces,
  lines,
  payments,
  runSheetItems,
  positions,
  assignments,
  incidents,
  turnaroundTasks,
  onSelect,
}: Props) {
  const span = hireSpan(bookings);
  const spaceNames = [
    ...new Set(
      bookings
        .map((entry) => spaces.find((room) => room.id === entry.space_id)?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];

  const money = paymentSummary(lines, payments);
  // Guard the divide: a hire with no quote lines must not render NaN%.
  const paidPercent =
    money.charged > 0 ? Math.min(100, Math.max(0, (money.received / money.charged) * 100)) : 0;
  const overpaid = money.outstanding < 0;

  const unfilled = positions.reduce(
    (short, position) => short + unfilledCount(position, assignments),
    0
  );
  const safety = incidentSummary(incidents);
  const turnaround = turnaroundProgress(turnaroundTasks);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <OverviewCard title="Dates" section="dates" onSelect={onSelect}>
        {span ? (
          <>
            <p className="font-medium">
              {formatDate(span.startsAt)} – {formatDate(span.endsAt)}
            </p>
            <p className="text-muted-foreground">
              {plural(span.dayCount, "day")} · {plural(bookings.length, "booking")}
            </p>
            {spaceNames.length > 0 && <p className="text-muted-foreground">{spaceNames.join(", ")}</p>}
          </>
        ) : (
          <Empty>Nothing booked yet.</Empty>
        )}
      </OverviewCard>

      <OverviewCard title="Money" section="money" onSelect={onSelect}>
        {lines.length === 0 ? (
          <Empty>No quote lines yet.</Empty>
        ) : (
          <>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(money.charged)}</p>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="presentation"
            >
              <div className="h-full rounded-full bg-brand-teal" style={{ width: `${paidPercent}%` }} />
            </div>
            <p className="text-muted-foreground">
              {formatCurrency(money.received)} paid ·{" "}
              {money.isSettled && !overpaid
                ? "settled"
                : overpaid
                  ? `${formatCurrency(Math.abs(money.outstanding))} overpaid`
                  : `${formatCurrency(money.outstanding)} outstanding`}
            </p>
            <p className="text-muted-foreground">
              Quote {hire.quote_status.toLowerCase()} ·{" "}
              {hire.contract_signed_on
                ? "contract signed"
                : hire.contract_clauses
                  ? "contract unsigned"
                  : "no contract yet"}
            </p>
          </>
        )}
      </OverviewCard>

      <OverviewCard title="Plan" section="plan" onSelect={onSelect}>
        {runSheetItems.length === 0 && positions.length === 0 ? (
          <Empty>Nothing planned yet.</Empty>
        ) : (
          <>
            <p>{plural(runSheetItems.length, "run sheet item")}</p>
            <p className={unfilled > 0 ? "font-medium text-brand-danger" : "text-muted-foreground"}>
              {positions.length === 0
                ? "No roles yet"
                : unfilled > 0
                  ? `${plural(unfilled, "role")} unfilled`
                  : "Every role filled"}
            </p>
          </>
        )}
      </OverviewCard>

      <OverviewCard title="On the day" section="day" onSelect={onSelect}>
        {safety.open === 0 ? (
          <p className="text-muted-foreground">
            No open incidents{safety.total > 0 ? ` · ${plural(safety.total, "resolved")}` : ""}.
          </p>
        ) : (
          <>
            <p className="font-medium text-brand-danger">{plural(safety.open, "open incident")}</p>
            {safety.needsAttention > 0 && (
              <p className="text-muted-foreground">
                {safety.needsAttention} serious or worse
              </p>
            )}
          </>
        )}
      </OverviewCard>

      <OverviewCard title="Afterwards" section="after" onSelect={onSelect} className="sm:col-span-2">
        {turnaround.total === 0 && !hire.debrief_completed_on ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <>
            <p>
              {turnaround.total === 0
                ? "No turnaround tasks"
                : `${turnaround.done} of ${turnaround.total} turnaround tasks done`}
            </p>
            <p className="text-muted-foreground">
              {hire.debrief_completed_on ? "Debrief written" : "No debrief yet"}
            </p>
          </>
        )}
      </OverviewCard>
    </div>
  );
}
