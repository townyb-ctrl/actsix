import { createPortal } from "react-dom";

import { formatCurrency } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import { quoteTotals, type VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

type Props = {
  workspaceName: string;
  logoUrl?: string | null;
  hire: VenueHire;
  lines: VenueQuoteLine[];
  /** Human-readable span of the hire, e.g. "10 Sep 2026 – 12 Sep 2026". */
  dates: string;
  spaceNames: string[];
};

/**
 * The printable hire agreement.
 *
 * Signed on paper: ACTSIX has no e-signature and adding one would mean a new
 * dependency and a third party holding the church's contracts. The signature
 * block below gets filled in by hand, and who signed it is recorded back on the
 * hire afterwards.
 */
export default function VenueContractPrintSheet({
  workspaceName,
  logoUrl,
  hire,
  lines,
  dates,
  spaceNames,
}: Props) {
  const totals = quoteTotals(lines);

  return createPortal(
    <article className="actsix-print-sheet" aria-hidden>
      <header className="actsix-print-header">
        {logoUrl && <img src={logoUrl} alt="" className="actsix-print-logo" />}

        <div className="actsix-print-headings">
          <p className="actsix-print-org">{workspaceName}</p>
          <h1 className="actsix-print-title">Venue hire agreement</h1>
          <p className="actsix-print-meta">
            {hire.name}
            {dates && `  ·  ${dates}`}
          </p>
        </div>
      </header>

      <section className="actsix-print-people">
        <p>
          <span className="actsix-print-people-label">Hirer</span>
          {hire.hirer_name || "—"}
          {hire.hirer_email && `, ${hire.hirer_email}`}
          {hire.hirer_phone && `, ${hire.hirer_phone}`}
        </p>
        {spaceNames.length > 0 && (
          <p>
            <span className="actsix-print-people-label">Spaces</span>
            {spaceNames.join(", ")}
          </p>
        )}
      </section>

      <div className="actsix-print-body">
        <p>
          <strong>Total to pay:</strong> {formatCurrency(totals.charges)}
          {totals.dueNow > 0 && (
            <>
              {" · "}
              <strong>Deposit to secure the date:</strong> {formatCurrency(totals.dueNow)}
            </>
          )}
          {totals.held - totals.dueNow > 0 && (
            <>
              {" · "}
              <strong>Refundable bond:</strong> {formatCurrency(totals.held - totals.dueNow)}
            </>
          )}
        </p>

        {hire.payment_terms && (
          <p>
            <strong>Payment terms:</strong> {hire.payment_terms}
          </p>
        )}

        {hire.contract_clauses && (
          <div style={{ marginTop: "12px", whiteSpace: "pre-wrap" }}>{hire.contract_clauses}</div>
        )}

        <div style={{ marginTop: "28px", display: "flex", gap: "32px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px solid #333", paddingTop: "4px" }}>
              Hirer signature and date
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px solid #333", paddingTop: "4px" }}>
              For {workspaceName}, and date
            </div>
          </div>
        </div>
      </div>
    </article>,
    document.body
  );
}
