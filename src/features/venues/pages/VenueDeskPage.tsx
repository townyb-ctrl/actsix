import { useMemo } from "react";
import { CalendarRange, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useNow } from "@/hooks/useNow";
import { useVenueHires } from "@/features/venues/api/venueHiresQueries";
import { useVenueBookings, useVenueSpaces } from "@/features/venues/api/venuesQueries";
import { useChurchEvents } from "@/features/venues/api/venueClashesQueries";
import { useVenueEnquiries } from "@/features/venues/api/venueEnquiriesQueries";
import {
  useWorkspacePayments,
  useWorkspaceQuoteLines,
} from "@/features/venues/api/venueReportsQueries";
import {
  useWorkspaceHireContacts,
  useWorkspacePositions,
  useWorkspaceTurnaroundTasks,
} from "@/features/venues/api/venueDeskQueries";
import { buildingStrip, deskSignals, type DeskHireInput } from "@/features/venues/lib/venueDesk";
import { bookingCoversDay } from "@/features/venues/lib/venueBookings";
import { paymentSummary } from "@/features/venues/lib/venuePayments";
import VenueDeskStrip from "@/features/venues/components/VenueDeskStrip";
import VenueDeskRun from "@/features/venues/components/VenueDeskRun";
import VenueDeskPlate, { type RunningHire } from "@/features/venues/components/VenueDeskPlate";
import VenueHireEditorModal from "@/features/venues/components/VenueHireEditorModal";

const STRIP_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The venue module's front page.
 *
 * The module used to open on a month grid of bookings, with hires, spaces,
 * signage, reports and the event-day screen as sibling noun pages - three of
 * them reachable only from buttons crammed into this page's header. That
 * arrangement answers "what kind of record is this", which is a question nobody
 * arrives with.
 *
 * This opens on when. The building's next fortnight sits across the top,
 * everything wanting a person runs underneath it in the order the week
 * actually arrives, and the facts somebody asks standing up - who is in the
 * building, what is owed, who is waiting on a reply - stay on the right at all
 * times.
 */
export default function VenueDeskPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newHireOpen, setNewHireOpen] = useState(false);

  // A desk whose whole promise is "what is happening now" cannot freeze its
  // clock at mount: a tab left open over midnight would keep insisting
  // yesterday was today, bands and all.
  const now = useNow();
  const windowStart = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    // Only the calendar day matters here; recomputing on every tick would
    // refetch the church diary twice a minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.getFullYear(), now.getMonth(), now.getDate()]
  );
  const windowEnd = useMemo(
    () => new Date(windowStart.getTime() + STRIP_DAYS * DAY_MS),
    [windowStart]
  );

  const { hires, loading: hiresLoading, error: hiresError } = useVenueHires(workspace?.id);
  const { spaces, error: spacesError } = useVenueSpaces(workspace?.id);
  // Unwindowed: a signal about an unpaid hire from March matters as much as one
  // about Saturday, and a windowed fetch would quietly drop it off the desk.
  const { bookings, loading: bookingsLoading, error: bookingsError } = useVenueBookings({
    workspaceId: workspace?.id,
  });
  const { events: churchEvents } = useChurchEvents({
    workspaceId: workspace?.id,
    startsAt: windowStart.toISOString(),
    endsAt: windowEnd.toISOString(),
  });
  const { lines, loading: linesLoading, error: linesError } = useWorkspaceQuoteLines(workspace?.id);
  const {
    payments,
    loading: paymentsLoading,
    error: paymentsError,
  } = useWorkspacePayments(workspace?.id);
  const { positions, assignments, error: positionsError } = useWorkspacePositions(workspace?.id);
  const { tasks: turnaround, error: turnaroundError } = useWorkspaceTurnaroundTasks(workspace?.id);
  const { contacts, error: contactsError } = useWorkspaceHireContacts(workspace?.id);
  const { enquiries } = useVenueEnquiries(workspace?.id);

  // Split, so the strip is not held hostage by the money queries: it needs only
  // bookings, spaces and the diary, and it is the first thing anybody reads.
  const stripLoading = !workspace?.id || bookingsLoading;
  const loading = stripLoading || hiresLoading || linesLoading || paymentsLoading;

  /**
   * A dropped feed must never read as a calm desk. Every one of these tables
   * feeds the "wanting a person" list, and the list's failure mode is silence -
   * which is indistinguishable from good news unless it is said out loud. The
   * money feeds are in here too: on failure they return empty, every amount
   * owed vanishes from the run, and the books print R 0,00 in calm ink.
   */
  const moneyFailed = Boolean(linesError || paymentsError);
  const failed = Boolean(
    hiresError ||
      bookingsError ||
      spacesError ||
      positionsError ||
      turnaroundError ||
      contactsError ||
      moneyFailed
  );

  const strip = useMemo(
    () =>
      buildingStrip({
        days: STRIP_DAYS,
        bookings,
        spaces,
        events: churchEvents,
        hires,
        from: windowStart,
      }),
    [bookings, spaces, churchEvents, hires, windowStart]
  );

  const signals = useMemo(() => {
    const byHire = new Map<string, DeskHireInput>();

    for (const hire of hires) {
      byHire.set(hire.id, {
        hire,
        bookings: [],
        lines: [],
        payments: [],
        positions: [],
        assignments: [],
        turnaround: [],
        contacts: [],
      });
    }

    for (const booking of bookings) {
      if (booking.hire_id) byHire.get(booking.hire_id)?.bookings.push(booking);
    }
    for (const line of lines) byHire.get(line.hire_id)?.lines.push(line);
    for (const payment of payments) byHire.get(payment.hire_id)?.payments.push(payment);
    for (const position of positions) byHire.get(position.hire_id)?.positions.push(position);
    for (const task of turnaround) byHire.get(task.hire_id)?.turnaround.push(task);
    for (const contact of contacts) byHire.get(contact.hire_id)?.contacts.push(contact);

    // Assignments hang off positions, so they are routed through the position
    // they fill rather than carrying a hire id of their own.
    const hireOfPosition = new Map(positions.map((position) => [position.id, position.hire_id]));
    for (const assignment of assignments) {
      const hireId = hireOfPosition.get(assignment.position_id);
      if (hireId) byHire.get(hireId)?.assignments.push(assignment);
    }

    return deskSignals([...byHire.values()], churchEvents, now);
  }, [hires, bookings, lines, payments, positions, assignments, turnaround, contacts, churchEvents, now]);

  const running: RunningHire[] = useMemo(() => {
    const spaceName = (spaceId: string | null) =>
      spaces.find((space) => space.id === spaceId)?.name || "Unknown space";

    return hires
      .filter((hire) => hire.status !== "Cancelled")
      .map((hire) => {
        const today = bookings.filter(
          (booking) =>
            booking.hire_id === hire.id &&
            booking.status !== "Cancelled" &&
            bookingCoversDay(booking, now)
        );
        if (today.length === 0) return null;
        return { hire, where: [...new Set(today.map((b) => spaceName(b.space_id)))] };
      })
      .filter((entry): entry is RunningHire => entry !== null);
  }, [hires, bookings, spaces, now]);

  const books = useMemo(() => {
    const liveHireIds = new Set(
      hires.filter((hire) => hire.status !== "Cancelled" && hire.quote_status !== "Declined").map((h) => h.id)
    );

    let outstanding = 0;
    let heldBond = 0;

    for (const hire of hires) {
      if (!liveHireIds.has(hire.id)) continue;
      const summary = paymentSummary(
        lines.filter((line) => line.hire_id === hire.id),
        payments.filter((payment) => payment.hire_id === hire.id)
      );
      if (summary.outstanding > 0) outstanding += summary.outstanding;
      heldBond += summary.bondHeld;
    }

    return { outstanding, heldBond };
  }, [hires, lines, payments]);

  const enquiriesWaiting = useMemo(
    () => enquiries.filter((enquiry) => enquiry.status === "New" || enquiry.status === "In review").length,
    [enquiries]
  );

  const today = now.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <PageHeader
        title="Venue hire"
        subtitle={today}
        actions={
          <>
            <Button variant="outline" className="min-h-10" asChild>
              <Link to="/venues/diary">
                <CalendarRange className="h-4 w-4" />
                Diary
              </Link>
            </Button>
            <Button className="actsix-btn-primary min-h-10" onClick={() => setNewHireOpen(true)}>
              <Plus className="h-4 w-4" />
              New hire
            </Button>
          </>
        }
      />

      <div className="actsix-page-body space-y-3">
        <VenueDeskStrip strip={strip} loading={stripLoading} />

        <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <VenueDeskRun signals={signals} loading={loading} failed={failed} />

          {/* Sticky, because these are the facts somebody keeps needing while
              reading the list beside them. */}
          <aside className="space-y-3 xl:sticky xl:top-4">
            <VenueDeskPlate
              running={running}
              outstanding={books.outstanding}
              heldBond={books.heldBond}
              enquiriesWaiting={enquiriesWaiting}
              loading={loading}
              moneyFailed={moneyFailed}
            />
          </aside>
        </div>
      </div>

      <VenueHireEditorModal
        open={newHireOpen}
        hire={null}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setNewHireOpen}
        onSaved={(hireId) => {
          queryClient.invalidateQueries({ queryKey: ["venue-hires"] });
          if (hireId) navigate(`/venues/hires/${hireId}`);
        }}
      />
    </div>
  );
}
