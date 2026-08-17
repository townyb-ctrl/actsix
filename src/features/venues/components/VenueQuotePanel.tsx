import { Plus, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import {
  isHeldKind,
  lineTotal,
  quoteTotals,
  VENUE_QUOTE_STATUSES,
  type VenueQuoteLine,
  type VenueQuoteStatus,
} from "@/features/venues/lib/venueQuotes";

type Props = {
  lines: VenueQuoteLine[];
  quoteStatus: VenueQuoteStatus;
  quoteSentAt: string | null;
  onAddLine: () => void;
  onEditLine: (line: VenueQuoteLine) => void;
  onStatusChange: (status: VenueQuoteStatus) => void;
  onPrint: () => void;
};

const statusVariant = (status: VenueQuoteStatus) => {
  if (status === "Accepted") return "default" as const;
  if (status === "Declined") return "outline" as const;
  return "secondary" as const;
};

export default function VenueQuotePanel({
  lines,
  quoteStatus,
  quoteSentAt,
  onAddLine,
  onEditLine,
  onStatusChange,
  onPrint,
}: Props) {
  const totals = quoteTotals(lines);

  return (
    <section className="st-panel" aria-labelledby="quote-heading">
      <div className="st-panel-head">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="st-panel-title" id="quote-heading">
            Quote
          </h2>
          <Badge variant={statusVariant(quoteStatus)}>{quoteStatus}</Badge>
        </div>

        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="min-h-9"
            onClick={onPrint}
            disabled={lines.length === 0}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button size="sm" variant="ghost" className="min-h-9" onClick={onAddLine}>
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No lines yet. Add the venue fee, any staffing charged to the hirer, add-ons, and the
          deposit.
        </p>
      ) : (
        // Rows, not a table: the old `<tr onClick>` could be clicked but never
        // reached by a keyboard, so half the people using this could not edit a
        // quote line at all.
        lines.map((line) => (
          <button
            key={line.id}
            type="button"
            onClick={() => onEditLine(line)}
            className="action-row flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{line.description}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {line.kind}
                {isHeldKind(line.kind) && " · held"}
                {line.kind === "Discount" && " · off the total"}
              </span>
            </span>

            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {line.quantity} × {formatCurrency(line.unit_price)}
            </span>

            <span className="w-28 shrink-0 text-right font-mono text-xs tabular-nums">
              {line.kind === "Discount" && "−"}
              {formatCurrency(Math.abs(lineTotal(line)))}
            </span>
          </button>
        ))
      )}

      <dl className="space-y-1 border-t border-[--st-line-soft] px-4 py-3 text-sm">
        <div className="flex justify-between font-semibold">
          <dt>Total to pay</dt>
          <dd className="font-mono tabular-nums">{formatCurrency(totals.charges)}</dd>
        </div>
        {totals.held > 0 && (
          <>
            <div className="flex justify-between text-muted-foreground">
              <dt className="text-xs">Deposit due to secure the date</dt>
              <dd className="font-mono text-xs tabular-nums">{formatCurrency(totals.dueNow)}</dd>
            </div>
            {totals.held - totals.dueNow > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <dt className="text-xs">Refundable bond</dt>
                <dd className="font-mono text-xs tabular-nums">
                  {formatCurrency(totals.held - totals.dueNow)}
                </dd>
              </div>
            )}
          </>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t border-[--st-line-soft] px-4 py-3">
        <span className="text-xs text-muted-foreground">Mark as</span>
        {VENUE_QUOTE_STATUSES.map((status) => (
          <Button
            key={status}
            size="sm"
            className="min-h-9"
            variant={quoteStatus === status ? "default" : "outline"}
            onClick={() => onStatusChange(status)}
          >
            {status}
          </Button>
        ))}
      </div>

      {quoteSentAt && (
        <p className="border-t border-[--st-line-soft] px-4 py-3 text-xs text-muted-foreground">
          Marked sent on{" "}
          {new Date(quoteSentAt).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          . ACTSIX does not send it, email it to the hirer yourself.
        </p>
      )}
    </section>
  );
}
