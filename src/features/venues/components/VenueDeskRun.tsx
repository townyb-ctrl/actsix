import { AlertTriangle, ArrowRight, CircleCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { DESK_BANDS, type DeskSignal } from "@/features/venues/lib/venueDesk";

type Props = {
  signals: DeskSignal[];
  loading?: boolean;
  failed?: boolean;
};

const whenLabel = (at: string | null) => {
  if (!at) return "no dates";
  return new Date(at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
};

/**
 * Everything across every hire that wants a person, banded by how soon.
 *
 * The module used to answer "what kind of record is this" - a page for hires, a
 * page for bookings, a page for signage. This answers the question somebody
 * actually arrives with, which is "what is going to go wrong". A hire is
 * context on the row, not the container around it.
 */
export default function VenueDeskRun({ signals, loading = false, failed = false }: Props) {
  const hot = signals.filter((signal) => signal.weight === "hot").length;

  return (
    <section className="st-panel" aria-labelledby="desk-run-heading">
      <div className="st-panel-head">
        <h2 className="st-panel-title" id="desk-run-heading">
          Wanting a person
        </h2>
        <span className="st-tally">
          {loading ? "…" : hot > 0 ? `${hot} can't wait` : `${signals.length}`}
        </span>
      </div>

      {failed && (
        <div className="st-error">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Some of this could not be loaded, so the list below is{" "}
            <strong>not the whole picture</strong>. Treat a quiet desk as unknown until it reloads.
          </span>
        </div>
      )}

      {loading ? (
        <div className="px-4 py-4" aria-busy="true">
          <span className="sr-only">Reading the week…</span>
          {[0, 1, 2, 3].map((row) => (
            <span key={row} className="st-skeleton mt-2 block h-[42px] w-full first:mt-0" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <CircleCheck className="h-6 w-6 text-[--st-green]" aria-hidden="true" />
          <p className="text-sm font-semibold">Nothing is waiting on you</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Every hire on the books has its dates, its people, its money and its paperwork. This
            list fills itself the moment one of them slips.
          </p>
        </div>
      ) : (
        DESK_BANDS.map((band) => {
          const rows = signals.filter((signal) => signal.band === band.id);
          if (rows.length === 0) return null;

          return (
            <div key={band.id}>
              <div className="st-band">
                <h3 className="label-eyebrow">{band.name}</h3>
                {band.id === "now" ? (
                  <Link
                    to="/venues/today"
                    className="st-band-blurb inline-flex items-center gap-1 underline"
                  >
                    Open the day
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                ) : (
                  band.blurb && <span className="st-band-blurb">{band.blurb}</span>
                )}
              </div>

              {rows.map((signal) => (
                <Link
                  key={signal.id}
                  // No deep link into a section any more: the hire page has no
                  // sections to land in. It opens on exactly this problem,
                  // because it sorts itself the same way this list does.
                  to={`/venues/hires/${signal.hireId}`}
                  className="st-signal"
                  data-weight={signal.weight}
                >
                  {/* The slot is always reserved so every title starts on one
                      line; only the rows that cannot wait carry a mark in it.
                      A dot on the quiet rows read as a stray bullet and made
                      the mark mean nothing on the rows that needed it. */}
                  {signal.weight === "hot" ? (
                    <AlertTriangle className="st-signal-mark" aria-hidden="true" />
                  ) : (
                    <span className="st-signal-mark" aria-hidden="true" />
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="st-signal-title">{signal.title}</span>
                    <span className="st-signal-sub">
                      {signal.hireName} · {whenLabel(signal.at)}
                    </span>
                  </span>

                  <span className="st-signal-fact">{signal.fact}</span>
                </Link>
              ))}
            </div>
          );
        })
      )}
    </section>
  );
}
