import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card>
    <CardContent className="space-y-1 py-4">
      <p className="label-eyebrow">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

export default function VenueReportsPage() {
  const { workspace } = useCurrentWorkspace();
  const [months, setMonths] = useState(6);

  const { enquiries } = useVenueEnquiries(workspace?.id);
  const { hires } = useVenueHires(workspace?.id);
  const { bookings } = useVenueBookings({ workspaceId: workspace?.id });
  const { spaces } = useVenueSpaces(workspace?.id);
  const { lines } = useWorkspaceQuoteLines(workspace?.id);
  const { payments } = useWorkspacePayments(workspace?.id);

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

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire"
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
            hint={busiest && busiest.hours > 0 ? `${busiest.hours} hours booked` : "Nothing booked"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enquiries by stage</CardTitle>
            </CardHeader>
            <CardContent>
              {funnel.total === 0 ? (
                <p className="text-sm text-muted-foreground">No enquiries in this period.</p>
              ) : (
                <ChartContainer
                  config={chartConfig}
                  className="h-56 w-full"
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hours booked per space</CardTitle>
            </CardHeader>
            <CardContent>
              {utilisation.every((entry) => entry.hours === 0) ? (
                <p className="text-sm text-muted-foreground">Nothing booked in this period.</p>
              ) : (
                <ChartContainer
                  config={chartConfig}
                  className="h-56 w-full"
                  role="img"
                  aria-label={`Hours booked per space: ${utilisation
                    .map((entry) => `${entry.name} ${entry.hours} hours`)
                    .join(", ")}`}
                >
                  <BarChart data={utilisation} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      unit="h"
                    />
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
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by event type</CardTitle>
          </CardHeader>
          <CardContent>
            {revenue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hires in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th scope="col" className="pb-2 font-medium">Event type</th>
                      <th scope="col" className="pb-2 text-right font-medium">Hires</th>
                      <th scope="col" className="pb-2 text-right font-medium">Quoted</th>
                      <th scope="col" className="pb-2 text-right font-medium">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.map((entry) => (
                      <tr key={entry.eventType} className="border-b last:border-0">
                        <th scope="row" className="py-2 text-left font-normal">{entry.eventType}</th>
                        <td className="py-2 text-right tabular-nums">{entry.hires}</td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(entry.quoted)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(entry.received)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hirers who came back</CardTitle>
          </CardHeader>
          <CardContent>
            {repeats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody has hired more than once yet. This counts every hire on record, not just this
                period.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {repeats.map((entry) => (
                  <li key={entry.name} className="flex justify-between gap-3">
                    <span>{entry.name}</span>
                    <span className="tabular-nums text-muted-foreground">{entry.hires} hires</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
