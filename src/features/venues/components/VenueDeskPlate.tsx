import { AlertTriangle, ArrowRight, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import { formatCurrency } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";

export type RunningHire = {
  hire: VenueHire;
  /** Space names it holds today, already resolved. */
  where: string[];
};

type Props = {
  running: RunningHire[];
  outstanding: number;
  heldBond: number;
  enquiriesWaiting: number;
  loading?: boolean;
  /** The money feed dropped, so these totals are not real and must say so. */
  moneyFailed?: boolean;
};

/**
 * The facts that are true regardless of which list you were reading.
 *
 * Everything here answers a question somebody asks standing up rather than
 * sitting down: who is in my building, what do they owe, is anybody waiting on
 * a reply. Phone numbers dial - the reason this card gets opened at all is
 * usually that something needs saying out loud.
 */
export default function VenueDeskPlate({
  running,
  outstanding,
  heldBond,
  enquiriesWaiting,
  loading = false,
  moneyFailed = false,
}: Props) {
  return (
    <>
      <section className="st-panel" aria-labelledby="desk-now-heading">
        <div className="st-panel-head">
          <h2 className="st-panel-title" id="desk-now-heading">
            In the building
          </h2>
          {/* The day screen hangs off here rather than off a band that only
              renders when something is already going wrong - the busiest
              healthy Saturday was the one day it could not be opened. */}
          {running.length > 0 ? (
            <Link to="/venues/today" className="inline-flex items-center gap-1 text-xs underline">
              Open the day
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : (
            <span className="st-tally">{loading ? "…" : 0}</span>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-4">
            <span className="st-skeleton block h-[42px] w-full" />
          </div>
        ) : running.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            Nobody in today. The building is yours.
          </p>
        ) : (
          running.map(({ hire, where }) => (
            <div key={hire.id} className="action-row">
              <Link
                to={`/venues/hires/${hire.id}`}
                className="block truncate text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--st-accent]"
              >
                {hire.name}
              </Link>

              {where.length > 0 && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{where.join(" · ")}</p>
              )}

              {hire.onsite_contact_phone ? (
                <a
                  href={`tel:${hire.onsite_contact_phone}`}
                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs underline"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-mono tabular-nums">{hire.onsite_contact_phone}</span>
                  {hire.onsite_contact_name && (
                    <span className="text-muted-foreground">· {hire.onsite_contact_name}</span>
                  )}
                </a>
              ) : (
                <p className="mt-1 text-xs text-[--st-rose]">Nobody to phone</p>
              )}
            </div>
          ))
        )}
      </section>

      <section className="st-panel" aria-labelledby="desk-books-heading">
        <div className="st-panel-head">
          <h2 className="st-panel-title" id="desk-books-heading">
            The books
          </h2>
        </div>

        {moneyFailed && (
          <div className="st-error">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              The quote and payment feeds didn&rsquo;t load, so these totals are{" "}
              <strong>not real</strong>. Nothing here means nothing is owed.
            </span>
          </div>
        )}

        <div className="st-figure">
          <span className="st-figure-label">Owed to the church</span>
          <span
            className="st-figure-value"
            data-tone={moneyFailed ? "quiet" : outstanding > 0 ? "rose" : undefined}
          >
            {loading || moneyFailed ? "—" : formatCurrency(outstanding)}
          </span>
        </div>

        {/* A bond is somebody else's money sitting in the account. It is shown
            beside what is owed because forgetting to return one is the quietest
            way this module can cost a church its reputation. */}
        <div className="st-figure">
          <span className="st-figure-label">Bonds held, owed back</span>
          <span className="st-figure-value" data-tone="quiet">
            {loading || moneyFailed ? "—" : formatCurrency(heldBond)}
          </span>
        </div>
      </section>

      <Link
        to="/venues/enquiries"
        className="st-panel block transition hover:border-[--st-line-strong] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--st-accent]"
      >
        <div className="st-panel-head">
          <h2 className="st-panel-title">Enquiries</h2>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="st-figure">
          <span className="st-figure-label">
            {enquiriesWaiting === 1 ? "Waiting on a reply" : "Waiting on replies"}
          </span>
          <span className="st-figure-value" data-tone={enquiriesWaiting > 0 ? undefined : "quiet"}>
            {loading ? "—" : enquiriesWaiting}
          </span>
        </div>
      </Link>
    </>
  );
}
