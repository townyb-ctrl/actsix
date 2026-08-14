import { createPortal } from "react-dom";

import { formatCurrency } from "@/features/venues/lib/venueBookings";
import { isHeldKind, lineTotal, quoteTotals, type VenueQuoteLine } from "@/features/venues/lib/venueQuotes";
import type { VenueHire } from "@/features/venues/lib/venueHires";

type Props = {
  workspaceName: string;
  logoUrl?: string | null;
  hire: VenueHire;
  lines: VenueQuoteLine[];
  /** Human-readable span of the hire, e.g. "10 Sep 2026 – 12 Sep 2026". */
  dates: string;
  paymentTerms: string;
};

/**
 * The printable quote.
 *
 * Same approach as MeetingPrintSheet: rendered into a portal on document.body
 * because printing hides `#root` wholesale, and hidden on screen via
 * `.actsix-print-sheet`. No PDF library - the browser's print dialog produces
 * the PDF, which is one fewer dependency to carry for years.
 */
export default function VenueQuotePrintSheet({
  workspaceName,
  logoUrl,
  hire,
  lines,
  dates,
  paymentTerms,
}: Props) {
  const totals = quoteTotals(lines);

  return createPortal(
    <article className="actsix-print-sheet" aria-hidden>
      <header className="actsix-print-header">
        {logoUrl && <img src={logoUrl} alt="" className="actsix-print-logo" />}

        <div className="actsix-print-headings">
          <p className="actsix-print-org">{workspaceName}</p>
          <h1 className="actsix-print-title">Venue hire quote</h1>
          <p className="actsix-print-meta">
            {hire.name}
            {dates && `  ·  ${dates}`}
          </p>
        </div>
      </header>

      <section className="actsix-print-people">
        <p>
          <span className="actsix-print-people-label">For</span>
          {hire.hirer_name || "—"}
          {hire.hirer_email && `, ${hire.hirer_email}`}
        </p>
        {hire.event_type && (
          <p>
            <span className="actsix-print-people-label">Event</span>
            {hire.event_type}
          </p>
        )}
      </section>

      <div className="actsix-print-body">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #999", padding: "6px 4px" }}>
                Line
              </th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #999", padding: "6px 4px" }}>
                Qty
              </th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #999", padding: "6px 4px" }}>
                Each
              </th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #999", padding: "6px 4px" }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #ddd" }}>
                  {line.description}
                  {isHeldKind(line.kind) && " (held)"}
                </td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #ddd", textAlign: "right" }}>
                  {line.quantity}
                </td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #ddd", textAlign: "right" }}>
                  {formatCurrency(line.unit_price)}
                </td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #ddd", textAlign: "right" }}>
                  {line.kind === "Discount" && "−"}
                  {formatCurrency(Math.abs(lineTotal(line)))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>
                Total to pay
              </td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>
                {formatCurrency(totals.charges)}
              </td>
            </tr>
            {totals.dueNow > 0 && (
              <tr>
                <td colSpan={3} style={{ padding: "2px 4px", textAlign: "right" }}>
                  Deposit due to secure the date
                </td>
                <td style={{ padding: "2px 4px", textAlign: "right" }}>
                  {formatCurrency(totals.dueNow)}
                </td>
              </tr>
            )}
            {totals.held - totals.dueNow > 0 && (
              <tr>
                <td colSpan={3} style={{ padding: "2px 4px", textAlign: "right" }}>
                  Refundable bond
                </td>
                <td style={{ padding: "2px 4px", textAlign: "right" }}>
                  {formatCurrency(totals.held - totals.dueNow)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {paymentTerms && (
          <p style={{ marginTop: "16px" }}>
            <strong>Payment terms:</strong> {paymentTerms}
          </p>
        )}

        {hire.notes && <p style={{ marginTop: "8px" }}>{hire.notes}</p>}
      </div>
    </article>,
    document.body
  );
}
