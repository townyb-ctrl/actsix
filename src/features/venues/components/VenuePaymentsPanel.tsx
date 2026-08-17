import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const Figure = ({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) => (
  <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
    <dt className={muted ? "text-xs text-muted-foreground" : "text-xs"}>{label}</dt>
    <dd className={`font-mono text-xs tabular-nums ${muted ? "text-muted-foreground" : ""}`}>
      {value}
    </dd>
  </div>
);

export default function VenuePaymentsPanel({
  lines,
  payments,
  onAddPayment,
  onEditPayment,
}: Props) {
  const summary = paymentSummary(lines, payments);
  const overpaid = summary.outstanding < 0;

  return (
    <section className="st-panel" aria-labelledby="payments-heading">
      <div className="st-panel-head">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="st-panel-title" id="payments-heading">
            Payments
          </h2>
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

        <Button size="sm" variant="ghost" className="min-h-9" onClick={onAddPayment}>
          <Plus className="h-4 w-4" />
          Record payment
        </Button>
      </div>

      <dl className="space-y-1 px-4 py-3">
        <Figure label="Quoted" value={formatCurrency(summary.charged)} muted />
        <Figure label="Received" value={formatCurrency(summary.received)} muted />
        {summary.refunded > 0 && (
          <Figure label="Refunded" value={formatCurrency(summary.refunded)} muted />
        )}
        <Figure
          label={overpaid ? "Owed back" : "Outstanding"}
          value={formatCurrency(Math.abs(summary.outstanding))}
          strong
        />
        {summary.bondHeld !== 0 && (
          <Figure
            label="Bond held (owed back)"
            value={formatCurrency(summary.bondHeld)}
            muted
          />
        )}
      </dl>

      {payments.length === 0 ? (
        <p className="border-t border-[--st-line-soft] px-4 py-4 text-sm text-muted-foreground">
          Nothing recorded yet. Add each payment as it lands, so the balance here matches the bank.
        </p>
      ) : (
        payments.map((payment) => (
          <button
            key={payment.id}
            type="button"
            onClick={() => onEditPayment(payment)}
            className="action-row flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {formatDate(payment.paid_on)}
                {payment.amount < 0 && <span className="text-brand-danger"> · refund</span>}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {payment.method}
                {payment.kind === "Bond" && " · bond"}
                {payment.reference && ` · ${payment.reference}`}
              </span>
            </span>

            <span
              className={`shrink-0 font-mono text-xs tabular-nums ${
                payment.amount < 0 ? "text-brand-danger" : ""
              }`}
            >
              {formatCurrency(Math.abs(payment.amount))}
            </span>
          </button>
        ))
      )}
    </section>
  );
}
