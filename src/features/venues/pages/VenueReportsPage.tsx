import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PageHeader } from "@/components/PageHeader";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useVenueEnquiries } from "@/features/venues/api/venueEnquiriesQueries";
import { useVenueHires } from "@/features/venues/api/venueHiresQueries";
import { useVenueBookings, useVenueSpaces } from "@/features/venues/api/venuesQueries";
import {
  useWorkspacePayments,
  useWorkspaceQuoteLines,
} from "@/features/venues/api/venueReportsQueries";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import { VENUE_ENQUIRY_STATUSES } from "@/features/venues/lib/venueEnquiries";
import {
  enquiryFunnel,
  monthsWindow,
  repeatHirers,
  revenueByEventType,
  spaceUtilisation,
  withinReportWindow,
} from "@/features/venues/lib/venueReports";

const RANGES = [
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "12 months", months: 12 },
];

const chartConfig = {
  count: { label: "Enquiries", color: "hsl(var(--brand-teal))" },
  hours: { label: "Hours booked", color: "hsl(var(--brand-teal))" },
};

/**
 * One headline number and the sentence that qualifies it.
 *
 * Mono, because a row of four of these is a column of numbers however it is
 * laid out, and proportional digits make the four disagree about where their
 * baselines are.
 */
const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="st-panel px-4 py-3.5">
    <p className="label-eyebrow">{label}</p>
    <p className="mt-1.5 font-mono text-[1.375rem] font-medium leading-tight tabular-nums text-[--st-ink]">
      {value}
    </p>
    {hint && <p className="mt-1 text-xs text-[--st-ink-3]">{hint}</p>}
  </div>
);

const Panel = ({ title, tally, children }: { title: string; tally?: string; children: React.ReactNode }) => (
  <section className="st-panel">
    <div className="st-panel-head">
      <h2 className="st-panel-title">{title}</h2>
      {tally && <span className="st-tally">{tally}</span>}
    </div>
    {children}
  </section>
);

const Quiet = ({ children }: { children: React.ReactNode }) => (
  <p className="px-4 py-6 text-center text-sm text-[--st-ink-3]">{children}</p>
);

export default function VenueReportsPage() {
  const { workspace } = useCurrentWorkspace();
  const [months, setMonths] = useState(6);

  const { enquiries, loading: enquiriesLoading, error: enquiriesError } = useVenueEnquiries(
    workspace?.id
  );
  const { hires, loading: hiresLoading, error: hiresError } = useVenueHires(workspace?.id);
  const { bookings, loading: bookingsLoading, error: bookingsError } = useVenueBookings({
    workspaceId: workspace?.id,
  });
  const { spaces, loading: spacesLoading, error: spacesError } = useVenueSpaces(workspace?.id);
  const { lines, loading: linesLoading, error: linesError } = useWorkspaceQuoteLines(workspace?.id);
  const {
    payments,
    loading: paymentsLoading,
    error: paymentsError,
  } = useWorkspacePayments(workspace?.id);

  // A report is a claim about the whole period, so it waits for the whole
  // period. A feed that lands a beat late reads as an empty list, and an empty
  // list here does not read as "still loading" - it reads as "you earned
  // nothing", which is a worse lie than a spinner.
  const loading =
    enquiriesLoading ||
    hiresLoading ||
    bookingsLoading ||
    spacesLoading ||
    linesLoading ||
    paymentsLoading;

  const failures = [
    { label: "enquiries", error: enquiriesError },
    { label: "hires", error: hiresError },
    { label: "bookings", error: bookingsError },
    { label: "spaces", error: spacesError },
    { label: "quote lines", error: linesError },
    { label: "payments", error: paymentsError },
  ].filter((feed) => feed.error);

  const window = useMemo(() => monthsWindow(months), [months]);

  const funnel = useMemo(
    () => enquiryFunnel(withinReportWindow(enquiries, window), VENUE_ENQUIRY_STATUSES),
    [enquiries, window]
  );

  const utilisation = useMemo(
    () => spaceUtilisation(bookings, spaces, window),
    [bookings, spaces, window]
  );

  const windowHires = useMemo(() => withinReportWindow(hires, window), [hires, window]);

  const revenue = useMemo(
    () => revenueByEventType(windowHires, lines, payments),
    [windowHires, lines, payments]
  );

  const repeats = useMemo(() => repeatHirers(hires), [hires]);

  const totalReceived = revenue.reduce((sum, entry) => sum + entry.received, 0);
  const totalQuoted = revenue.reduce((sum, entry) => sum + entry.quoted, 0);
  const busiest = utilisation[0];

  const failedLabel =
    failures.length === 1
      ? `the ${failures[0].label}`
      : `${failures
          .slice(0, -1)
          .map((feed) => `the ${feed.label}`)
          .join(", ")} and ${`the ${failures[failures.length - 1]?.label}`}`;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`Last ${months} months`}
        actions={
          <>
            <Button variant="outline" className="min-h-10" asChild>
              <Link to="/venues">
                <ArrowLeft className="h-4 w-4" />
                Bookings
              </Link>
            </Button>
            {RANGES.map((range) => (
              <Button
                key={range.months}
                variant={months === range.months ? "default" : "outline"}
                className="min-h-10"
                onClick={() => setMonths(range.months)}
              >
                {range.label}
              </Button>
            ))}
          </>
        }
      />

      <div className="actsix-page-body actsix-page-stack">
        {/* Every figure below is a sum over a feed. One feed short and the sums
            are all still perfectly formatted and all quietly wrong, so the page
            has to say so rather than report the shortfall as a result. */}
        {failures.length > 0 && (
          <div className="st-panel" role="alert">
            <div className="st-error">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                We couldn&rsquo;t load {failedLabel}. Every figure on this page is{" "}
                <strong>counted from incomplete data</strong> and is too low. Check your connection
                and reload before reporting any of it.
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading the reports…</span>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="st-panel px-4 py-3.5">
                  <span className="st-skeleton block h-2.5 w-1/2" />
                  <span className="st-skeleton mt-3 block h-5 w-3/5" />
                  <span className="st-skeleton mt-2.5 block h-2.5 w-4/5" />
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="st-panel">
                  <div className="st-panel-head">
                    <span className="st-skeleton block h-2.5 w-32" />
                  </div>
                  <div className="px-4 py-4">
                    <span className="st-skeleton block h-56 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Enquiries"
                value={String(funnel.total)}
                hint={`${funnel.accepted} accepted, ${funnel.declined} declined`}
              />
              <Stat
                label="Conversion"
                value={`${Math.round(funnel.conversionRate * 100)}%`}
                hint="Of enquiries actually decided"
              />
              <Stat
                label="Received"
                value={formatCurrency(totalReceived)}
                hint={`${formatCurrency(totalQuoted)} quoted`}
              />
              <Stat
                label="Busiest space"
                value={busiest && busiest.hours > 0 ? busiest.name : "—"}
                hint={
                  busiest && busiest.hours > 0 ? `${busiest.hours} hours booked` : "Nothing booked"
                }
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="Enquiries by stage" tally={`${funnel.total}`}>
                {funnel.total === 0 ? (
                  <Quiet>No enquiries in this period.</Quiet>
                ) : (
                  <ChartContainer
                    config={chartConfig}
                    className="h-56 w-full px-2 py-3"
                    role="img"
                    aria-label={`Enquiries by stage: ${funnel.stages
                      .map((stage) => `${stage.status} ${stage.count}`)
                      .join(", ")}`}
                  >
                    <BarChart data={funnel.stages} margin={{ left: -20 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="status" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                )}
              </Panel>

              <Panel
                title="Hours booked per space"
                tally={`${utilisation.reduce((sum, entry) => sum + entry.hours, 0)}h`}
              >
                {utilisation.every((entry) => entry.hours === 0) ? (
                  <Quiet>Nothing booked in this period.</Quiet>
                ) : (
                  <ChartContainer
                    config={chartConfig}
                    className="h-56 w-full px-2 py-3"
                    role="img"
                    aria-label={`Hours booked per space: ${utilisation
                      .map((entry) => `${entry.name} ${entry.hours} hours`)
                      .join(", ")}`}
                  >
                    <BarChart data={utilisation} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} unit="h" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                )}
              </Panel>
            </div>

            <Panel
              title="Revenue by event type"
              tally={revenue.length > 0 ? `${revenue.length} types` : undefined}
            >
              {revenue.length === 0 ? (
                <Quiet>No hires in this period.</Quiet>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[--st-line-soft] text-left">
                        <th scope="col" className="label-eyebrow px-4 py-2 font-bold">
                          Event type
                        </th>
                        <th scope="col" className="label-eyebrow px-4 py-2 text-right font-bold">
                          Hires
                        </th>
                        <th scope="col" className="label-eyebrow px-4 py-2 text-right font-bold">
                          Quoted
                        </th>
                        <th scope="col" className="label-eyebrow px-4 py-2 text-right font-bold">
                          Received
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.map((entry) => (
                        <tr
                          key={entry.eventType}
                          className="border-b border-[--st-line-soft] last:border-0"
                        >
                          <th scope="row" className="px-4 py-2.5 text-left font-normal">
                            {entry.eventType}
                          </th>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                            {entry.hires}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[--st-ink-2]">
                            {formatCurrency(entry.quoted)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                            {formatCurrency(entry.received)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel
              title="Hirers who came back"
              tally={repeats.length > 0 ? `${repeats.length}` : undefined}
            >
              {repeats.length === 0 ? (
                <Quiet>
                  Nobody has hired more than once yet. This counts every hire on record, not just
                  this period.
                </Quiet>
              ) : (
                <ul>
                  {repeats.map((entry) => (
                    <li key={entry.name} className="st-figure">
                      <span className="st-figure-label">{entry.name}</span>
                      <span className="st-figure-value" data-tone="quiet">
                        {entry.hires} hires
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
