import { Link } from "react-router-dom";

import type { BuildingStrip, StripDay } from "@/features/venues/lib/venueDesk";

type Props = {
  strip: BuildingStrip;
  loading?: boolean;
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });

const rangeLabel = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = (value: Date) =>
    value.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  const time = (value: Date) =>
    value.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

  return start.toDateString() === end.toDateString()
    ? `${day(start)} · ${time(start)}–${time(end)}`
    : `${day(start)} – ${day(end)}`;
};

const occupancyLabel = (day: StripDay) => {
  if (day.entries.length === 0) return "nothing in the building";
  const names = day.entries.map((entry) => entry.title);
  return names.length <= 2 ? names.join(" and ") : `${names.length} in the building`;
};

/**
 * The building's next fortnight, one column a day, today at the left edge, and
 * underneath it the roll naming what the bars are.
 *
 * This sits above everything else because it is the question underneath every
 * other question in the module: is the building free. Hires and the church's
 * own diary are drawn in the same strip - an answer that counted only paid
 * hires would be a lie by omission, and it is exactly the lie that produces a
 * double-booked Saturday.
 *
 * The strip alone carries one bit per day, which is not enough to be worth the
 * top of the page. Fourteen columns leave no room for a label and a `title`
 * tooltip is dead on touch, so the roll below says what, in the same colours,
 * one row per hire. Strip answers when; roll answers what.
 *
 * The whole day column is the target, never the individual bars: a 7px mark is
 * not something anybody hits with a thumb, and wrapping each one in a link
 * collided with the app's 44px touch-target floor, which stretched every bar
 * into a block on phones.
 */
export default function VenueDeskStrip({ strip, loading = false }: Props) {
  const { days, roll } = strip;
  const occupied = days.filter((day) => day.entries.length > 0).length;

  return (
    <section className="st-panel" aria-labelledby="desk-strip-heading">
      <div className="st-panel-head">
        <h2 className="st-panel-title" id="desk-strip-heading">
          The building
        </h2>
        <span className="st-tally">
          {loading ? "…" : `${occupied}/${days.length} days spoken for`}
        </span>
      </div>

      {loading ? (
        <div className="st-strip" aria-hidden="true">
          {days.map((day) => (
            <div key={day.iso} className="st-strip-day">
              <span className="st-skeleton block h-[52px] w-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="st-strip">
            {days.map((day) => (
              <Link
                key={day.iso}
                to={`/venues/diary?on=${day.dateKey}`}
                className="st-strip-day"
                data-today={day.isToday}
                data-weekend={day.isWeekend}
                aria-label={`${dayLabel(day.iso)} — ${occupancyLabel(day)}`}
              >
                <span className="st-strip-head" aria-hidden="true">
                  <span className="st-strip-month">{day.monthLabel || " "}</span>
                  <span className="st-strip-weekday">{day.weekday}</span>
                  <span className="st-strip-date">{day.dayOfMonth}</span>
                </span>

                <span className="st-strip-bars" aria-hidden="true">
                  {day.lanes.length === 0 ? (
                    <span className="st-strip-empty" />
                  ) : (
                    // Every lane renders on every day, empty ones as a spacer,
                    // so a bar keeps its height across the run it belongs to.
                    day.lanes.map((entry, lane) =>
                      entry ? (
                        <span
                          key={`${day.iso}-${lane}`}
                          className="st-strip-bar"
                          data-kind={entry.kind}
                          data-continues={entry.continues}
                          style={{ background: entry.color }}
                        />
                      ) : (
                        <span key={`${day.iso}-${lane}`} className="st-strip-gap" />
                      )
                    )
                  )}
                </span>
              </Link>
            ))}
          </div>

          {roll.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Nothing in the building for the next fortnight.
            </p>
          ) : (
            roll.map((occupant) =>
              occupant.hireId ? (
                <Link
                  key={occupant.key}
                  to={`/venues/hires/${occupant.hireId}`}
                  className="action-row flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--st-accent]"
                >
                  <span
                    className="st-swatch"
                    style={{ background: occupant.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {occupant.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {rangeLabel(occupant.startsAt, occupant.endsAt)}
                  </span>
                </Link>
              ) : (
                <div key={occupant.key} className="action-row flex items-center gap-3">
                  <span
                    className="st-swatch"
                    data-kind="church"
                    style={{ background: occupant.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {occupant.title}
                    <span className="text-muted-foreground"> · church diary</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {rangeLabel(occupant.startsAt, occupant.endsAt)}
                  </span>
                </div>
              )
            )
          )}
        </>
      )}
    </section>
  );
}
