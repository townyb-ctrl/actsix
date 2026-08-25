import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, PartyPopper, Plus, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useVenueHires } from "@/features/venues/api/venueHiresQueries";
import { useVenueBookings } from "@/features/venues/api/venuesQueries";
import { hireSpan, type VenueHire } from "@/features/venues/lib/venueHires";
import { bandForSpan, DESK_BANDS, type DeskBand } from "@/features/venues/lib/venueDesk";
import VenueHireEditorModal from "@/features/venues/components/VenueHireEditorModal";
import VenuePanelSection from "@/features/venues/components/VenuePanelSection";
import VenueListSkeleton from "@/features/venues/components/VenueListSkeleton";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

type Listed = {
  hire: VenueHire;
  band: DeskBand;
  span: ReturnType<typeof hireSpan>;
  bookingCount: number;
};

const HireRow = ({ hire, span, bookingCount }: Listed) => (
  <Link
    to={`/venues/hires/${hire.id}`}
    className="action-row flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--st-accent]"
  >
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="truncate text-sm font-semibold">{hire.name}</span>
        {hire.status !== "Confirmed" && (
          <Badge variant={hire.status === "Cancelled" ? "outline" : "secondary"}>
            {hire.status}
          </Badge>
        )}
        {hire.event_type && (
          <Badge variant="outline" className="font-normal">
            {hire.event_type}
          </Badge>
        )}
      </span>

      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {span ? formatDate(span.startsAt) : "Nothing booked yet"}
        {span && span.dayCount > 1 && ` · ${span.dayCount} days`}
        {hire.hirer_name && ` · ${hire.hirer_name}`}
      </span>
    </span>

    <span className="shrink-0 text-xs text-muted-foreground">
      <span className="font-mono tabular-nums">{bookingCount}</span>{" "}
      {bookingCount === 1 ? "booking" : "bookings"}
    </span>
  </Link>
);

/**
 * Every hire on the books, in the order the calendar delivers them.
 *
 * It used to be a flat list behind status filter pills, which asked somebody to
 * know which status they wanted before they could see anything. Status is
 * rarely the question - "what is coming" is - so the register bands by when,
 * exactly like the desk, and the finished ones fold away at the bottom instead
 * of burying the live ones.
 */
export default function VenueHiresPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { hires, loading: hiresLoading, error } = useVenueHires(workspace?.id);
  // Unwindowed: a hire's bookings can sit anywhere on the calendar, and the
  // span shown on each row has to reflect all of them.
  const { bookings } = useVenueBookings({ workspaceId: workspace?.id });
  const loading = !workspace?.id || hiresLoading;

  const toastedErrorRef = useRef(false);

  useEffect(() => {
    if (error && !toastedErrorRef.current) {
      toastedErrorRef.current = true;
      toast.error("Could not load hires", { description: error.message });
    }
    if (!error) {
      toastedErrorRef.current = false;
    }
  }, [error]);

  const { live, finished } = useMemo(() => {
    const now = new Date();
    // Bands answer "what is coming". They cannot answer "where is the thing
    // called Kruger", which is the other half of why anybody opens a register.
    const needle = query.trim().toLowerCase();
    const matches = (hire: VenueHire) =>
      !needle ||
      hire.name.toLowerCase().includes(needle) ||
      hire.hirer_name.toLowerCase().includes(needle) ||
      hire.event_type.toLowerCase().includes(needle);

    const rows: Listed[] = hires.filter(matches).map((hire) => {
      const mine = bookings.filter(
        (booking) => booking.hire_id === hire.id && booking.status !== "Cancelled"
      );
      const span = hireSpan(mine);
      return { hire, span, band: bandForSpan(span, now), bookingCount: mine.length };
    });

    // "Finished with" is a judgement about the record, not the calendar: a hire
    // that ran last month but is still owed money is live work, and folding it
    // away is how an invoice goes unchased for a year.
    const isFinished = (row: Listed) =>
      row.hire.status === "Cancelled" ||
      (row.hire.status === "Completed" && row.band === "closing");

    const order = DESK_BANDS.map((band) => band.id);

    const sortByWhen = (a: Listed, b: Listed) => {
      const byBand = order.indexOf(a.band) - order.indexOf(b.band);
      if (byBand !== 0) return byBand;
      if (a.span && b.span) return a.span.startsAt.localeCompare(b.span.startsAt);
      return a.hire.name.localeCompare(b.hire.name);
    };

    return {
      live: rows.filter((row) => !isFinished(row)).sort(sortByWhen),
      finished: rows.filter(isFinished).sort((a, b) => {
        if (a.span && b.span) return b.span.startsAt.localeCompare(a.span.startsAt);
        return a.hire.name.localeCompare(b.hire.name);
      }),
    };
  }, [hires, bookings, query]);

  return (
    <div>
      <PageHeader
        title="Hires"
        subtitle="One event, however many spaces and days it runs across."
        actions={
          <Button className="actsix-btn-primary min-h-10" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New hire
          </Button>
        }
      />

      <div className="actsix-page-body space-y-3">
        {/* A toast is dismissible and then gone; an empty register that failed
            to load is indistinguishable from a church with no hires. */}
        {error && (
          <div className="st-panel" role="alert">
            <div className="st-error">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                We couldn&rsquo;t load the hires. {error.message} This page is{" "}
                <strong>not showing real data</strong>. Check your connection and reload.
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <VenueListSkeleton shape="row" />
        ) : error ? null : hires.length === 0 ? (
          <section className="st-panel">
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <PartyPopper className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold">No hires yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                A hire holds everything about one event: every space, every day, the hirer, and the
                notes. Single bookings on the diary carry on working without one.
              </p>
              <Button
                className="actsix-btn-primary mt-2 min-h-10"
                onClick={() => setModalOpen(true)}
              >
                Create your first hire
              </Button>
            </div>
          </section>
        ) : (
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a hire by name, hirer or kind of event"
                aria-label="Find a hire"
                className="pl-9"
              />
            </div>

            <section className="st-panel" aria-labelledby="hires-live-heading">
              <div className="st-panel-head">
                <h2 className="st-panel-title" id="hires-live-heading">
                  On the books
                </h2>
                <span className="st-tally">{live.length}</span>
              </div>

              {live.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                  {query.trim()
                    ? "Nothing live matches that."
                    : "Nothing live. Everything on the books is finished with."}
                </p>
              ) : (
                DESK_BANDS.map((band) => {
                  const rows = live.filter((row) => row.band === band.id);
                  if (rows.length === 0) return null;

                  return (
                    <div key={band.id}>
                      <div className="st-band">
                        <h3 className="label-eyebrow">{band.name}</h3>
                        <span className="st-band-blurb">{band.blurb}</span>
                      </div>
                      {rows.map((row) => (
                        <HireRow key={row.hire.id} {...row} />
                      ))}
                    </div>
                  );
                })
              )}
            </section>

            {/* One heading, not two: the panel head and the fold's own lid were
                naming the same set with the same number, stacked. */}
            {finished.length > 0 && (
              <section className="st-panel">
                <VenuePanelSection
                  title="Finished with"
                  hint={`${finished.length} completed or cancelled`}
                >
                  {finished.map((row) => (
                    <HireRow key={row.hire.id} {...row} />
                  ))}
                </VenuePanelSection>
              </section>
            )}
          </>
        )}
      </div>

      <VenueHireEditorModal
        open={modalOpen}
        hire={null}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setModalOpen}
        onSaved={(hireId) => {
          queryClient.invalidateQueries({ queryKey: ["venue-hires"] });
          if (hireId) navigate(`/venues/hires/${hireId}`);
        }}
      />
    </div>
  );
}
