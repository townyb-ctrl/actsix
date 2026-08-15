import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import { paymentSummary, type VenuePayment } from "@/features/venues/lib/venuePayments";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

type Props = {
  lines: VenueQuoteLine[];
  payments: VenuePayment[];
  onAddPayment: () => void;
  onEditPayment: (payment: VenuePayment) => void;
};

const formatDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function VenuePaymentsPanel({
  lines,
  payments,
  onAddPayment,
  onEditPayment,
}: Props) {
  const summary = paymentSummary(lines, payments);
  const overpaid = summary.outstanding < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Payments</CardTitle>
          {summary.charged > 0 && (
            <Badge variant={summary.isSettled ? "default" : "secondary"}>
              {overpaid
                ? `Overpaid by ${formatCurrency(Math.abs(summary.outstanding))}`
                : summary.isSettled
                  ? "Settled"
                  : `${formatCurrency(summary.outstanding)} outstanding`}
            </Badge>
          )}
        </div>

        <Button size="sm" variant="outline" onClick={onAddPayment}>
          <Plus className="h-4 w-4" />
          Record payment
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Quoted</dt>
            <dd className="tabular-nums">{formatCurrency(summary.charged)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Received</dt>
            <dd className="tabular-nums">{formatCurrency(summary.received)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>{overpaid ? "Owed back" : "Outstanding"}</dt>
            <dd className="tabular-nums">
              {formatCurrency(Math.abs(summary.outstanding))}
            </dd>
          </div>
          {summary.bondHeld !== 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Bond held (owed back)</dt>
              <dd className="tabular-nums">{formatCurrency(summary.bondHeld)}</dd>
            </div>
          )}
        </dl>

        {payments.length === 0 ? (
          <p className="border-t pt-3 text-sm text-muted-foreground">
            Nothing recorded yet. Add each payment as it lands, so the balance here matches the
            bank.
          </p>
        ) : (
          <ul className="space-y-1 border-t pt-3">
            {payments.map((payment) => (
              <li key={payment.id}>
                <button
                  type="button"
                  onClick={() => onEditPayment(payment)}
                  className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded px-1 py-1 text-left text-sm transition hover:bg-muted/40 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
                >
                  <span>
                    {formatDate(payment.paid_on)} · {payment.method}
                    {payment.kind === "Bond" && " · bond"}
                    {payment.reference && (
                      <span className="text-muted-foreground"> · {payment.reference}</span>
                    )}
                  </span>
                  <span
                    className={payment.amount < 0 ? "tabular-nums text-brand-danger" : "tabular-nums"}
                  >
                    {formatCurrency(payment.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
