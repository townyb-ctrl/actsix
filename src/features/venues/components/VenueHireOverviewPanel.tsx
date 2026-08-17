import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { formatCurrency, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";
import { isDebriefStarted } from "@/features/venues/lib/venueDebrief";
import { hireSpan, type VenueHire } from "@/features/venues/lib/venueHires";
import { paymentSummary, type VenuePayment } from "@/features/venues/lib/venuePayments";
import { unfilledTotal, type VenuePosition, type VenuePositionAssignment } from "@/features/venues/lib/venuePositions";
import { incidentSummary, type VenueIncident } from "@/features/venues/lib/venueSafety";
import {
  turnaroundProgress,
  walkthroughCoverage,
  type VenueTurnaroundTask,
} from "@/features/venues/lib/venueTurnaround";
import type { VenueHireContact } from "@/features/venues/lib/venueSafety";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
import type { VenueWalkthrough } from "@/features/venues/lib/venueTurnaround";
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
  contacts: VenueHireContact[];
  turnaroundTasks: VenueTurnaroundTask[];
  walkthroughs: VenueWalkthrough[];
  /** Sections whose data failed to load; those rows must not claim to be clear. */
  failedSections: Set<VenueHireSectionId>;
  onSelect: (id: VenueHireSectionId) => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * One row per rail section: name, where it is up to, and its number in the mono
 * column. Rows rather than cards because this is the page's instrument panel -
 * five separated boxes made five separate readings, and the numbers never
 * lined up with each other.
 *
 * The whole row is the control, and it carries an explicit label: the visible
 * text reads as three fragments, which a screen reader would otherwise run
 * together into one unpunctuated sentence.
 */
function OverviewRow({
  title,
  section,
  label,
  tally,
  alert,
  onSelect,
  children,
}: {
  title: string;
  section: VenueHireSectionId;
  label: string;
  tally?: ReactNode;
  alert?: boolean;
  onSelect: (id: VenueHireSectionId) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={`${title}: ${label}. Open the ${title} section.`}
      onClick={() => onSelect(section)}
      className="action-row flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal/40"
    >
      <span className="w-24 shrink-0 text-[13px] font-bold">{title}</span>

      <span className="min-w-0 flex-1 truncate text-[13px]" aria-hidden="true">
        {children}
      </span>

      {tally && (
        <span
          className={`shrink-0 font-mono text-xs tabular-nums ${
            alert ? "font-bold text-brand-danger" : "text-muted-foreground"
          }`}
          aria-hidden="true"
        >
          {tally}
        </span>
      )}

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

const Failed = () => (
  <span className="font-medium text-brand-danger">Couldn&rsquo;t load. Not showing real data.</span>
);

/**
 * Where a hire is up to, one row per rail section.
 *
 * Nothing here is fetched or calculated that the sections do not already know -
 * the helpers below are the same pure functions their panels call. The rows
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
  contacts,
  turnaroundTasks,
  walkthroughs,
  failedSections,
  onSelect,
}: Props) {
  const span = hireSpan(bookings);
  // hireSpan already drops cancelled bookings internally; the count and space
  // list below need to agree with that, so they filter the same way.
  const active = bookings.filter((booking) => booking.status !== "Cancelled");
  const spaceNames = [
    ...new Set(
      active
        .map((entry) => spaces.find((room) => room.id === entry.space_id)?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];

  const money = paymentSummary(lines, payments);
  // A refund is money going the other way, not a negative payment: the summary
  // keeps the two apart so nothing here has to render "-R 600,00 paid".
  const { refunded } = money;
  const paid = money.received;
  // Guard the divide: a hire with no quote lines must not render NaN%.
  const paidPercent =
    money.charged > 0 ? Math.min(100, Math.max(0, (paid / money.charged) * 100)) : 0;
  const overpaid = money.outstanding < 0;

  // The hire record carries its own on-site contact, and the safety panel keeps
  // a list of them. Reading only the list is how the sidebar came to name a
  // person while the summary said there was nobody to call.
  const nobodyToCall = contacts.length === 0 && !hire.onsite_contact_name.trim();

  const unfilled = unfilledTotal(positions, assignments);
  const safety = incidentSummary(incidents);
  const turnaround = turnaroundProgress(turnaroundTasks);
  const debriefed = isDebriefStarted(hire);
  // A bond argument needs both ends, which is exactly what the walkthrough
  // panel's own badge says. Reading it any other way is how the summary and the
  // panel ended up disagreeing about the same bond.
  const walkthroughOpen = !walkthroughCoverage(walkthroughs).bothEndsCaptured;
  // A signed contract against a draft quote is a real contradiction, not a
  // status pair - somebody has agreed to something nobody has priced.
  const quoteBehindContract = hire.quote_status === "Draft" && Boolean(hire.contract_signed_on);

  return (
    <section className="st-panel" aria-labelledby="hire-overview-heading">
      <div className="st-panel-head">
        <h2 className="st-panel-title" id="hire-overview-heading">
          Where this hire is up to
        </h2>
        <span className="st-tally">
          {span ? `${plural(span.dayCount, "day")}` : "unbooked"}
        </span>
      </div>

      <OverviewRow
        title="Dates"
        section="dates"
        onSelect={onSelect}
        label={
          failedSections.has("dates")
            ? "could not be loaded"
            : span
              ? `${formatDate(span.startsAt)} to ${formatDate(span.endsAt)}, ${plural(
                  active.length,
                  "booking"
                )}${spaceNames.length > 0 ? `, ${spaceNames.join(", ")}` : ""}`
              : "nothing booked yet"
        }
        tally={span ? `${active.length}` : undefined}
      >
        {failedSections.has("dates") ? (
          <Failed />
        ) : span ? (
          <>
            {formatDate(span.startsAt)} – {formatDate(span.endsAt)}
            {spaceNames.length > 0 && (
              <span className="text-muted-foreground"> · {spaceNames.join(", ")}</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Nothing booked yet.</span>
        )}
      </OverviewRow>

      <OverviewRow
        title="Money"
        section="money"
        onSelect={onSelect}
        alert={!failedSections.has("money") && money.outstanding > 0}
        label={
          failedSections.has("money")
            ? "could not be loaded"
            : money.charged === 0
              ? "no quote lines yet"
              : `${formatCurrency(money.charged)} charged, ${
                  money.isSettled && !overpaid
                    ? "settled"
                    : overpaid
                      ? `${formatCurrency(Math.abs(money.outstanding))} overpaid`
                      : `${formatCurrency(money.outstanding)} outstanding`
                }${quoteBehindContract ? ", contract signed against a draft quote" : ""}`
        }
        tally={
          failedSections.has("money") || money.charged === 0
            ? undefined
            : formatCurrency(money.outstanding)
        }
      >
        {failedSections.has("money") ? (
          <Failed />
        ) : money.charged === 0 ? (
          <span className="text-muted-foreground">No quote lines yet.</span>
        ) : (
          <>
            {formatCurrency(money.charged)}
            <span className="text-muted-foreground">
              {" · "}
              {refunded > 0
                ? `${formatCurrency(refunded)} refunded`
                : `${formatCurrency(paid)} paid`}
              {" · quote "}
              {hire.quote_status.toLowerCase()}
            </span>
            {quoteBehindContract && (
              <span className="font-medium text-brand-danger">
                {" · signed against a draft quote"}
              </span>
            )}
          </>
        )}
      </OverviewRow>

      {/* The paid meter is a real progressbar: its ratio exists nowhere else
          once the row's text is truncated. */}
      {/* Only once something has actually been paid: an empty track reads as a
          filled one at a glance, which is the opposite of the truth. */}
      {!failedSections.has("money") && money.charged > 0 && paid > 0 && (
        <div className="px-4 pb-3">
          <div
            className="h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Paid so far"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(paidPercent)}
          >
            <div
              className="h-full rounded-full bg-brand-teal"
              style={{ width: `${paidPercent}%` }}
            />
          </div>
        </div>
      )}

      <OverviewRow
        title="Plan"
        section="plan"
        onSelect={onSelect}
        alert={!failedSections.has("plan") && unfilled > 0}
        label={
          failedSections.has("plan")
            ? "could not be loaded"
            : runSheetItems.length === 0 && positions.length === 0
              ? "nothing planned yet"
              : `${plural(runSheetItems.length, "run sheet item")}, ${
                  positions.length === 0
                    ? "no roles yet"
                    : unfilled > 0
                      ? `${plural(unfilled, "role")} unfilled`
                      : "every role filled"
                }`
        }
        tally={
          failedSections.has("plan") || positions.length === 0
            ? undefined
            : unfilled > 0
              ? `${unfilled} open`
              : "staffed"
        }
      >
        {failedSections.has("plan") ? (
          <Failed />
        ) : runSheetItems.length === 0 && positions.length === 0 ? (
          <span className="text-muted-foreground">Nothing planned yet.</span>
        ) : (
          <>
            {plural(runSheetItems.length, "run sheet item")}
            <span className="text-muted-foreground">
              {" · "}
              {positions.length === 0 ? "no roles yet" : plural(positions.length, "role")}
            </span>
          </>
        )}
      </OverviewRow>

      <OverviewRow
        title="On the day"
        section="day"
        onSelect={onSelect}
        alert={!failedSections.has("day") && (safety.open > 0 || nobodyToCall)}
        label={
          failedSections.has("day")
            ? "could not be loaded"
            : `${
                safety.open > 0
                  ? `${plural(safety.open, "open incident")}`
                  : `no open incidents${safety.total > 0 ? `, ${safety.total} resolved` : ""}`
              }, ${
                nobodyToCall
                  ? "nobody to call"
                  : plural(contacts.length + (hire.onsite_contact_name.trim() ? 1 : 0), "contact")
              }`
        }
        tally={failedSections.has("day") ? undefined : safety.open > 0 ? `${safety.open}` : undefined}
      >
        {failedSections.has("day") ? (
          <Failed />
        ) : (
          <>
            {safety.open > 0 ? (
              <span className="font-medium text-brand-danger">
                {plural(safety.open, "open incident")}
              </span>
            ) : (
              <span className="text-muted-foreground">
                No open incidents{safety.total > 0 ? ` · ${safety.total} resolved` : ""}
              </span>
            )}
            {/* Nobody to phone is the failure this section exists to prevent, so
                it belongs on the summary rather than one click in. */}
            {nobodyToCall && (
              <span className="font-medium text-brand-danger"> · nobody to call</span>
            )}
          </>
        )}
      </OverviewRow>

      <OverviewRow
        title="Afterwards"
        section="after"
        onSelect={onSelect}
        alert={!failedSections.has("after") && walkthroughOpen}
        label={
          failedSections.has("after")
            ? "could not be loaded"
            : turnaround.total === 0 && !debriefed && !walkthroughOpen
              ? "nothing recorded yet"
              : `${
                  turnaround.total === 0
                    ? "no turnaround tasks"
                    : `${turnaround.done} of ${turnaround.total} turnaround tasks done`
                }, ${walkthroughOpen ? "walkthrough incomplete" : "walkthrough clear"}, ${
                  debriefed ? "debrief written" : "no debrief yet"
                }`
        }
        tally={
          failedSections.has("after") || turnaround.total === 0
            ? undefined
            : `${turnaround.done}/${turnaround.total}`
        }
      >
        {failedSections.has("after") ? (
          <Failed />
        ) : turnaround.total === 0 && !debriefed && !walkthroughOpen ? (
          <span className="text-muted-foreground">Nothing recorded yet.</span>
        ) : (
          <>
            {turnaround.total === 0
              ? "No turnaround tasks"
              : `${turnaround.done} of ${turnaround.total} turnaround tasks done`}
            {walkthroughOpen && (
              <span className="font-medium text-brand-danger"> · walkthrough incomplete</span>
            )}
            <span className="text-muted-foreground">
              {" · "}
              {debriefed ? "debrief written" : "no debrief yet"}
            </span>
          </>
        )}
      </OverviewRow>
    </section>
  );
}
