import { Plus, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Quote</CardTitle>
          <Badge variant={statusVariant(quoteStatus)}>{quoteStatus}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onPrint} disabled={lines.length === 0}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button size="sm" variant="outline" onClick={onAddLine}>
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No lines yet. Add the venue fee, any staffing charged to the hirer, add-ons, and the
            deposit.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2 font-semibold">Line</th>
                  <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                  <th className="py-2 pr-2 text-right font-semibold">Each</th>
                  <th className="py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={line.id}
                    onClick={() => onEditLine(line)}
                    className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40"
                  >
                    <td className="py-2 pr-2">
                      <span className="font-medium">{line.description}</span>
                      <span className="block text-xs text-muted-foreground">
                        {line.kind}
                        {isHeldKind(line.kind) && " · held"}
                        {line.kind === "Discount" && " · off the total"}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{line.quantity}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {formatCurrency(line.unit_price)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {line.kind === "Discount" && "−"}
                      {formatCurrency(Math.abs(lineTotal(line)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <dl className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between font-medium">
            <dt>Total to pay</dt>
            <dd className="tabular-nums">{formatCurrency(totals.charges)}</dd>
          </div>
          {totals.held > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <dt>Deposit due to secure the date</dt>
                <dd className="tabular-nums">{formatCurrency(totals.dueNow)}</dd>
              </div>
              {totals.held - totals.dueNow > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Refundable bond</dt>
                  <dd className="tabular-nums">{formatCurrency(totals.held - totals.dueNow)}</dd>
                </div>
              )}
            </>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-sm text-muted-foreground">Mark as</span>
          {VENUE_QUOTE_STATUSES.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={quoteStatus === status ? "default" : "outline"}
              onClick={() => onStatusChange(status)}
            >
              {status}
            </Button>
          ))}
        </div>

        {quoteSentAt && (
          <p className="text-xs text-muted-foreground">
            Marked sent on{" "}
            {new Date(quoteSentAt).toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            . ACTSIX does not send it — email it to the hirer yourself.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
