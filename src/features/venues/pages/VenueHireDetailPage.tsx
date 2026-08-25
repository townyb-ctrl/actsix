import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useHireBookings, useVenueHire } from "@/features/venues/api/venueHiresQueries";
import { useQuoteLines } from "@/features/venues/api/venueQuotesQueries";
import { setQuoteStatus } from "@/features/venues/api/venueQuotesApi";
import { useVenueBookings, useVenueSpaces } from "@/features/venues/api/venuesQueries";
import { useVenueResources } from "@/features/venues/api/venueResourcesQueries";
import { useRunSheet } from "@/features/venues/api/venueRunSheetQueries";
import { useChurchEvents } from "@/features/venues/api/venueClashesQueries";
import {
  useTurnaroundTasks,
  useWalkthroughs,
} from "@/features/venues/api/venueTurnaroundQueries";
import { useHireContacts, useIncidents } from "@/features/venues/api/venueSafetyQueries";
import {
  useAvPresets,
  useHireSigns,
  useResourceCheckouts,
  useVenueSigns,
} from "@/features/venues/api/venueSignageQueries";
import { signPlan } from "@/features/venues/lib/venueSignage";
import { paymentSummary } from "@/features/venues/lib/venuePayments";
import {
  clearingLatch,
  hireBoard,
  newVisit,
  openConcerns,
  settledConcerns,
  type HireConcernId,
} from "@/features/venues/lib/venueHireBoard";
import {
  usePositionAssignments,
  usePositionPeople,
  usePositionRoles,
  usePositions,
} from "@/features/venues/api/venuePositionsQueries";
import { unassignPosition } from "@/features/venues/api/venuePositionsApi";
import {
  usePayments,
  useWorkspaceContractClauses,
} from "@/features/venues/api/venuePaymentsQueries";
import { toast } from "sonner";
import type { VenueBooking } from "@/features/venues/lib/venueBookings";
import type { VenueQuoteLine, VenueQuoteStatus } from "@/features/venues/lib/venueQuotes";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
import type { VenuePosition, VenuePositionAssignment } from "@/features/venues/lib/venuePositions";
import type { VenuePayment } from "@/features/venues/lib/venuePayments";
import type { VenueTurnaroundTask } from "@/features/venues/lib/venueTurnaround";
import type { VenueIncident } from "@/features/venues/lib/venueSafety";
import { hireSpan } from "@/features/venues/lib/venueHires";
import VenueHireDaysPanel from "@/features/venues/components/VenueHireDaysPanel";
import VenueHireEditorModal from "@/features/venues/components/VenueHireEditorModal";
import VenueBookingModal from "@/features/venues/components/VenueBookingModal";
import VenueQuotePanel from "@/features/venues/components/VenueQuotePanel";
import VenueQuoteLineModal from "@/features/venues/components/VenueQuoteLineModal";
import VenueQuotePrintSheet from "@/features/venues/components/VenueQuotePrintSheet";
import VenueRunSheetPanel from "@/features/venues/components/VenueRunSheetPanel";
import VenueRunSheetItemModal from "@/features/venues/components/VenueRunSheetItemModal";
import VenueRunSheetPrintSheet from "@/features/venues/components/VenueRunSheetPrintSheet";
import VenuePositionBoard from "@/features/venues/components/VenuePositionBoard";
import VenuePositionEditorModal from "@/features/venues/components/VenuePositionEditorModal";
import VenuePositionAssignModal from "@/features/venues/components/VenuePositionAssignModal";
import VenuePaymentsPanel from "@/features/venues/components/VenuePaymentsPanel";
import VenuePaymentModal from "@/features/venues/components/VenuePaymentModal";
import VenueContractPanel from "@/features/venues/components/VenueContractPanel";
import VenueContractPrintSheet from "@/features/venues/components/VenueContractPrintSheet";
import VenueClashPanel from "@/features/venues/components/VenueClashPanel";
import VenueDebriefPanel from "@/features/venues/components/VenueDebriefPanel";
import VenuePortalPanel from "@/features/venues/components/VenuePortalPanel";
import VenueCloneHireModal from "@/features/venues/components/VenueCloneHireModal";
import VenueTurnaroundPanel from "@/features/venues/components/VenueTurnaroundPanel";
import VenueTurnaroundTaskModal from "@/features/venues/components/VenueTurnaroundTaskModal";
import VenueWalkthroughPanel from "@/features/venues/components/VenueWalkthroughPanel";
import VenueSafetyPanel from "@/features/venues/components/VenueSafetyPanel";
import VenueIncidentModal from "@/features/venues/components/VenueIncidentModal";
import VenueSignagePanel from "@/features/venues/components/VenueSignagePanel";
import VenueSignPrintSheet from "@/features/venues/components/VenueSignPrintSheet";
import VenueListSkeleton from "@/features/venues/components/VenueListSkeleton";
import VenueHireStandfirst from "@/features/venues/components/VenueHireStandfirst";
import VenueHireDocuments from "@/features/venues/components/VenueHireDocuments";
import VenueHireShelf from "@/features/venues/components/VenueHireShelf";
import VenueHireNotes from "@/features/venues/components/VenueHireNotes";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far away the hire is, said the way somebody would say it out loud. */
const relativeSpan = (span: { startsAt: string; endsAt: string }) => {
  const now = Date.now();
  const startsAt = new Date(span.startsAt).getTime();
  const endsAt = new Date(span.endsAt).getTime();

  if (startsAt <= now && endsAt >= now) return "running now";

  if (endsAt < now) {
    const days = Math.round((now - endsAt) / DAY_MS);
    if (days === 0) return "ended today";
    if (days === 1) return "ended yesterday";
    if (days < 21) return `ended ${days} days ago`;
    return `ended ${Math.round(days / 7)} weeks ago`;
  }

  const days = Math.round((startsAt - now) / DAY_MS);
  if (days === 0) return "starts today";
  if (days === 1) return "tomorrow";
  if (days < 21) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
};

export default function VenueHireDetailPage() {
  const { hireId } = useParams();
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<VenueBooking | null>(null);
  const [quoteLineModalOpen, setQuoteLineModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<VenueQuoteLine | null>(null);
  const [runSheetModalOpen, setRunSheetModalOpen] = useState(false);
  const [editingRunSheetItem, setEditingRunSheetItem] = useState<VenueRunSheetItem | null>(null);
  const [runSheetSeedIso, setRunSheetSeedIso] = useState<string | null>(null);
  /**
   * Which document to print. Both sheets live on document.body, so rendering
   * them at once would print both - only the requested one is mounted, and the
   * print dialog is opened once React has actually put it there.
   */
  const [printing, setPrinting] = useState<
    "quote" | "run-sheet" | "contract" | "signs" | null
  >(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<VenuePayment | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [turnaroundModalOpen, setTurnaroundModalOpen] = useState(false);
  const [editingTurnaroundTask, setEditingTurnaroundTask] = useState<VenueTurnaroundTask | null>(
    null
  );
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<VenueIncident | null>(null);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<VenuePosition | null>(null);
  const [positionSeedIso, setPositionSeedIso] = useState<string | null>(null);
  const [assigningPosition, setAssigningPosition] = useState<VenuePosition | null>(null);
  /** Which shelf row is expanded. Held here, not in the shelf - see below. */
  const [shelfOpenId, setShelfOpenId] = useState<HireConcernId | null>(null);

  /**
   * Every concern that has been open at any point during this visit.
   *
   * Without this the page reshuffles under the person using it. A concern's
   * attention is recomputed from the hire on every render, so recording a
   * signature clears the contract's own reason for being open, which drops the
   * panel out of the stack and remounts it collapsed - throwing away contract
   * wording that was typed but not yet saved. It also means the panel you just
   * acted in vanishes at the moment it worked, which is precisely the click-
   * hunting this page exists to remove.
   *
   * So the split is decided once per hire, on arrival, and only ever grows. A
   * concern that goes quiet stays where you were reading it until you come
   * back to the page.
   */
  const visit = useRef<{ hireId?: string; ids: Set<HireConcernId> }>({ ids: new Set() });

  /**
   * Whether this hire still wants somebody, and whether it stopped while they
   * were watching.
   *
   * Up here with `visit` because it answers the same kind of question — what has
   * happened since this reader arrived — and because it has to be declared
   * before the loading and error returns below, like every other hook.
   */
  const clearing = useRef({ wanted: false, clearedThisVisit: false });

  const { hire, loading, error: hireError } = useVenueHire(hireId);
  const {
    bookings: hireBookings,
    loading: bookingsLoading,
    error: bookingsError,
  } = useHireBookings(hireId);
  const { lines, loading: linesLoading, error: linesError } = useQuoteLines(hireId);
  const {
    items: runSheetItems,
    loading: runSheetLoading,
    error: runSheetError,
  } = useRunSheet(hireId);
  const { roles: positionRoles } = usePositionRoles(workspace?.id);
  const { positions, loading: positionsLoading, error: positionsError } = usePositions(hireId);
  // Dependent on the positions query, so it lands a beat after everything else.
  // Until it does, every position reads as unfilled.
  const { assignments, loading: assignmentsLoading } = usePositionAssignments(
    positions.map((position) => position.id)
  );
  const { people } = usePositionPeople(workspace?.id);
  const { payments, loading: paymentsLoading, error: paymentsError } = usePayments(hireId);
  const {
    tasks: turnaroundTasks,
    loading: turnaroundLoading,
    error: turnaroundError,
  } = useTurnaroundTasks(hireId);
  const {
    walkthroughs,
    loading: walkthroughsLoading,
    error: walkthroughsError,
  } = useWalkthroughs(hireId);
  const { incidents, loading: incidentsLoading, error: incidentsError } = useIncidents(hireId);
  const {
    contacts: hireContacts,
    loading: hireContactsLoading,
    error: contactsError,
  } = useHireContacts(hireId);
  const { signs, loading: signsLoading } = useVenueSigns(workspace?.id);
  const { links: hireSignLinks, loading: signLinksLoading } = useHireSigns(hireId);
  const { presets: avPresets } = useAvPresets(workspace?.id);
  const { checkouts, loading: checkoutsLoading } = useResourceCheckouts(hireId);
  const { clauses: workspaceClauses } = useWorkspaceContractClauses(workspace?.id);
  const { spaces, loading: spacesLoading } = useVenueSpaces(workspace?.id);
  const { resources } = useVenueResources(workspace?.id);
  // Every booking in the workspace, so the clash check inside the booking modal
  // sees bookings outside this hire too.
  const { bookings: allBookings } = useVenueBookings({ workspaceId: workspace?.id });

  // Only the church diary across this hire's own dates - there is no point
  // fetching a year of events to check one weekend.
  const bookedSpan = hireSpan(hireBookings);
  const { events: churchEvents, loading: churchEventsLoading } = useChurchEvents({
    workspaceId: workspace?.id,
    startsAt: bookedSpan?.startsAt,
    endsAt: bookedSpan?.endsAt,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-hire"] });
    queryClient.invalidateQueries({ queryKey: ["venue-hires"] });
    queryClient.invalidateQueries({ queryKey: ["venue-hire-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["venue-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["venue-quote-lines"] });
    queryClient.invalidateQueries({ queryKey: ["venue-run-sheet"] });
    queryClient.invalidateQueries({ queryKey: ["venue-positions"] });
    queryClient.invalidateQueries({ queryKey: ["venue-position-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["venue-payments"] });
    queryClient.invalidateQueries({ queryKey: ["venue-turnaround"] });
    queryClient.invalidateQueries({ queryKey: ["venue-walkthroughs"] });
    queryClient.invalidateQueries({ queryKey: ["venue-incidents"] });
    queryClient.invalidateQueries({ queryKey: ["venue-hire-contacts"] });
    queryClient.invalidateQueries({ queryKey: ["venue-signs"] });
    queryClient.invalidateQueries({ queryKey: ["venue-hire-signs"] });
    queryClient.invalidateQueries({ queryKey: ["venue-av-presets"] });
    queryClient.invalidateQueries({ queryKey: ["venue-checkouts"] });
  };

  const removeAssignment = async (assignment: VenuePositionAssignment) => {
    const { error } = await unassignPosition(assignment.id);
    if (error) {
      toast.error("Could not remove them from the position", { description: error.message });
      return;
    }
    refresh();
  };

  const changeQuoteStatus = async (status: VenueQuoteStatus) => {
    if (!hireId) return;
    const { error } = await setQuoteStatus(hireId, status);
    if (error) {
      toast.error("Could not update the quote", { description: error.message });
      return;
    }
    refresh();
  };

  useEffect(() => {
    if (!printing) return;
    window.print();
    setPrinting(null);
  }, [printing]);

  /**
   * Every feed the board reads, without exception.
   *
   * The board decides what still wants a person, and it decides it once, on
   * arrival. A feed that lands a beat later than the rest reads as an empty
   * list in the meantime - which the board would score as a problem, flag the
   * concern open, and then leave sitting open when the real data arrived. Worse
   * on the other side: an unarrived feed scored as settled is the "empty list
   * looks like good news" failure this module keeps having to guard against.
   */
  if (
    loading ||
    bookingsLoading ||
    spacesLoading ||
    linesLoading ||
    paymentsLoading ||
    runSheetLoading ||
    positionsLoading ||
    assignmentsLoading ||
    incidentsLoading ||
    hireContactsLoading ||
    signsLoading ||
    signLinksLoading ||
    checkoutsLoading ||
    walkthroughsLoading ||
    turnaroundLoading
  ) {
    return (
      // Same measure as the loaded page, or the whole column slides sideways
      // when the hire lands - the one thing a skeleton exists to prevent.
      <div
        className="venue-hire-measure actsix-page-body min-w-0 space-y-3 pt-8"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading the hire…</span>

        {/* The real geometry, so nothing jumps when the hire lands: the vitals
            band, then the stack. */}
        <span className="st-skeleton block h-[86px] w-full rounded-[var(--st-r-panel)]" />
        <VenueListSkeleton rows={2} />
        <VenueListSkeleton rows={3} />
      </div>
    );
  }

  // A failed load is not a deleted hire, and saying so would send someone off
  // to re-create a hire that is sitting right there.
  if (!hire && hireError) {
    return (
      <div className="actsix-page-body pt-8">
        <div className="st-panel" role="alert">
          <div className="st-error">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              We couldn&rsquo;t load this hire. {hireError.message} Nothing about it is showing
              right now. Check your connection and reload.
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!hire) {
    return (
      <div className="actsix-page-body pt-8">
        <p className="text-sm text-muted-foreground">
          This hire no longer exists.{" "}
          <Link to="/venues/hires" className="underline">
            Back to hires
          </Link>
          .
        </p>
      </div>
    );
  }

  const span = bookedSpan;

  /**
   * A dropped query must never read as good news. Every feed on this page can
   * fail on its own, and the panels all render "nothing yet" for an empty list,
   * so a failure has to be said out loud - and the concern it feeds has to stop
   * claiming it is clear.
   */
  const feedFailures = [
    { label: "the bookings", error: bookingsError, concern: "dates" as const },
    { label: "the quote", error: linesError, concern: "quote" as const },
    { label: "the payments", error: paymentsError, concern: "payments" as const },
    { label: "the run sheet", error: runSheetError, concern: "runsheet" as const },
    { label: "the positions", error: positionsError, concern: "positions" as const },
    { label: "the incidents", error: incidentsError, concern: "safety" as const },
    { label: "the on-the-day contacts", error: contactsError, concern: "safety" as const },
    { label: "the turnaround tasks", error: turnaroundError, concern: "turnaround" as const },
    { label: "the condition walkthrough", error: walkthroughsError, concern: "walkthrough" as const },
  ].filter((feed) => feed.error);

  const failedConcerns = Object.fromEntries(
    feedFailures.map((feed) => [feed.concern, true])
  ) as Partial<Record<HireConcernId, boolean>>;

  const failedLabel =
    feedFailures.length === 0
      ? ""
      : feedFailures.length === 1
        ? feedFailures[0].label
        : `${feedFailures
            .slice(0, -1)
            .map((feed) => feed.label)
            .join(", ")} and ${feedFailures[feedFailures.length - 1].label}`;

  const spaceNames = [
    ...new Set(
      hireBookings
        .filter((booking) => booking.status !== "Cancelled")
        .map((booking) => spaces.find((space) => space.id === booking.space_id)?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];

  const money = paymentSummary(lines, payments);

  /**
   * The whole page in one call: what each concern says about itself, and which
   * of them still want a person. The page then puts the wanting ones first and
   * leaves the rest as lines. This is the same judgement the desk makes across
   * every hire, made here for one - so a hire that is quiet on the desk is
   * quiet when you open it.
   */
  const board = hireBoard({
    hire,
    bookings: hireBookings,
    spaces,
    churchEvents,
    lines,
    payments,
    runSheetItems,
    positions,
    assignments,
    incidents,
    contacts: hireContacts,
    signs,
    signLinks: hireSignLinks,
    checkouts,
    walkthroughs,
    turnaround: turnaroundTasks,
    failed: failedConcerns,
  });

  // Idempotent set insertion, so React's double render in development adds the
  // same ids twice and lands in the same place.
  if (visit.current.hireId !== hire.id) {
    visit.current = { hireId: hire.id, ids: new Set() };
    // A new hire is a new visit. Without this, walking from a hire you just
    // finished into one that was already quiet congratulated you for the second
    // one, which you had not touched.
    clearing.current = newVisit();
  }
  for (const concern of openConcerns(board)) {
    // The one exception to promotion: a row somebody has open on the shelf.
    // Moving it into the stack would unmount the panel they are typing in and
    // take the typing with it - the same loss the other direction already
    // guards against. It joins the stack the moment they close the row.
    if (concern.id === shelfOpenId) continue;
    visit.current.ids.add(concern.id);
  }

  const open = board.filter((concern) => visit.current.ids.has(concern.id));
  const settled = board.filter((concern) => !visit.current.ids.has(concern.id));
  const stillWanting = open.filter((concern) => concern.attention !== null).length;

  // Did the board go clear *in front of this reader*, or was it already quiet
  // when they arrived? The difference is the whole point. Somebody who settles
  // the last thing a hire wanted has finished something, and this is the only
  // place in the app that knows it happened. Somebody opening a hire that was
  // already quiet has finished nothing, and marking it anyway would spend the
  // moment on every page load until it stopped meaning anything.
  //
  // Latched rather than derived per render, so a re-render - or StrictMode's
  // double one - cannot swallow the transition it is watching for.
  clearing.current = clearingLatch(clearing.current, stillWanting);
  const justCleared = clearing.current.clearedThisVisit;

  /**
   * One concern, one panel. The stack above and the shelf below both render
   * through here, so a panel is written once and cannot drift between "open
   * because it needs you" and "opened because you asked".
   */
  const panelFor = (id: HireConcernId): ReactNode => {
    switch (id) {
      case "dates":
        return (
          <VenueHireDaysPanel
            bookings={hireBookings}
            spaces={spaces}
            onAddBooking={() => {
              setEditingBooking(null);
              setBookingModalOpen(true);
            }}
            onEditBooking={(booking) => {
              setEditingBooking(booking);
              setBookingModalOpen(true);
            }}
          />
        );

      case "clashes":
        return (
          <VenueClashPanel
            bookings={hireBookings}
            events={churchEvents}
            spaces={spaces}
            loading={churchEventsLoading}
            hasSpan={Boolean(span)}
          />
        );

      case "quote":
        return (
          <VenueQuotePanel
            lines={lines}
            quoteStatus={hire.quote_status}
            quoteSentAt={hire.quote_sent_at}
            onAddLine={() => {
              setEditingLine(null);
              setQuoteLineModalOpen(true);
            }}
            onEditLine={(line) => {
              setEditingLine(line);
              setQuoteLineModalOpen(true);
            }}
            onStatusChange={changeQuoteStatus}
            onPrint={() => setPrinting("quote")}
          />
        );

      case "payments":
        return (
          <VenuePaymentsPanel
            lines={lines}
            payments={payments}
            onAddPayment={() => {
              setEditingPayment(null);
              setPaymentModalOpen(true);
            }}
            onEditPayment={(payment) => {
              setEditingPayment(payment);
              setPaymentModalOpen(true);
            }}
          />
        );

      case "contract":
        return (
          <VenueContractPanel
            hire={hire}
            workspaceClauses={workspaceClauses}
            onPrint={() => setPrinting("contract")}
            onSaved={refresh}
          />
        );

      case "portal":
        return <VenuePortalPanel hire={hire} onChanged={refresh} />;

      case "runsheet":
        return (
          <VenueRunSheetPanel
            items={runSheetItems}
            spaces={spaces}
            onAddItem={(dayIso) => {
              setEditingRunSheetItem(null);
              setRunSheetSeedIso(dayIso ?? span?.startsAt ?? null);
              setRunSheetModalOpen(true);
            }}
            onEditItem={(item) => {
              setEditingRunSheetItem(item);
              setRunSheetSeedIso(null);
              setRunSheetModalOpen(true);
            }}
            onPrint={() => setPrinting("run-sheet")}
          />
        );

      case "positions":
        return (
          <VenuePositionBoard
            positions={positions}
            assignments={assignments}
            roles={positionRoles}
            people={people}
            onAddPosition={(dayIso) => {
              setEditingPosition(null);
              setPositionSeedIso(dayIso ?? span?.startsAt ?? null);
              setPositionModalOpen(true);
            }}
            onEditPosition={(position) => {
              setEditingPosition(position);
              setPositionSeedIso(null);
              setPositionModalOpen(true);
            }}
            onAssign={setAssigningPosition}
            onUnassign={removeAssignment}
          />
        );

      case "safety":
        return (
          <VenueSafetyPanel
            hire={hire}
            incidents={incidents}
            contacts={hireContacts}
            workspaceId={workspace?.id || ""}
            userId={user?.id || ""}
            onAddIncident={() => {
              setEditingIncident(null);
              setIncidentModalOpen(true);
            }}
            onEditIncident={(incident) => {
              setEditingIncident(incident);
              setIncidentModalOpen(true);
            }}
            onChanged={refresh}
          />
        );

      case "signage":
        return (
          <VenueSignagePanel
            hire={hire}
            signs={signs}
            links={hireSignLinks}
            presets={avPresets}
            resources={resources}
            checkouts={checkouts}
            spaceIds={hireBookings.map((booking) => booking.space_id)}
            workspaceId={workspace?.id || ""}
            userId={user?.id || ""}
            takenBy={user?.email || ""}
            onPrintSigns={() => setPrinting("signs")}
            onChanged={refresh}
          />
        );

      case "walkthrough":
        return (
          <VenueWalkthroughPanel
            walkthroughs={walkthroughs}
            spaces={spaces}
            hireId={hire.id}
            workspaceId={workspace?.id || ""}
            userId={user?.id || ""}
            walkedBy={user?.email || ""}
            onChanged={refresh}
          />
        );

      case "turnaround":
        return (
          <VenueTurnaroundPanel
            tasks={turnaroundTasks}
            bookings={allBookings}
            spaces={spaces}
            doneBy={user?.email || ""}
            onAddTask={() => {
              setEditingTurnaroundTask(null);
              setTurnaroundModalOpen(true);
            }}
            onEditTask={(task) => {
              setEditingTurnaroundTask(task);
              setTurnaroundModalOpen(true);
            }}
            onChanged={refresh}
          />
        );

      case "debrief":
        return (
          <VenueDebriefPanel
            hire={hire}
            lines={lines}
            payments={payments}
            onClone={() => setCloneOpen(true)}
            onSaved={refresh}
          />
        );

      case "notes":
        return <VenueHireNotes hire={hire} />;

      default:
        return null;
    }
  };

  const spanLabel = span
    ? `${formatDate(span.startsAt)} – ${formatDate(span.endsAt)}`
    : "";

  return (
    // One measure for the whole page - title, rule and panels share a left edge
    // and a right one. Unbounded, a settled row threw its chevron a thousand
    // pixels from the name it belonged to and stopped being one thing to read;
    // the same cap `.st-signal` already carries, applied a level up.
    <div className="venue-hire-measure">
      <PageHeader
        title={hire.name}
        // Where the hire sits in time, in the desk's own words. A date range on
        // its own makes a reader do the subtraction; "in 2 days" is the fact
        // they were reaching for.
        subtitle={
          span
            ? `${formatDate(span.startsAt)} – ${formatDate(span.endsAt)} · ${span.dayCount} ${
                span.dayCount === 1 ? "day" : "days"
              } · ${relativeSpan(span)}`
            : "Nothing booked yet"
        }
        actions={
          <>
            <Button variant="outline" className="min-h-10" asChild>
              <Link to="/venues/hires">
                <ArrowLeft className="h-4 w-4" />
                Hires
              </Link>
            </Button>
            <Button variant="outline" className="min-h-10" onClick={() => setCloneOpen(true)}>
              <Copy className="h-4 w-4" />
              Repeat
            </Button>
            <VenueHireDocuments
              onPrint={setPrinting}
              hasQuote={lines.length > 0}
              hasRunSheet={runSheetItems.length > 0}
              hasSigns={signPlan(hireSignLinks, signs).length > 0}
            />
            <Button variant="outline" className="min-h-10" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit hire
            </Button>
          </>
        }
      />

      <div className="actsix-page-body venue-hire-stack min-w-0">
        {feedFailures.length > 0 && (
          <div className="st-panel" role="alert">
            <div className="st-error">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                We couldn&rsquo;t load {failedLabel}. Those parts of this hire are{" "}
                <strong>not showing real data</strong>, so treat anything they report as unknown.
                Check your connection and reload.
              </span>
            </div>
          </div>
        )}

        <VenueHireStandfirst
          hire={hire}
          spaceNames={spaceNames}
          outstanding={money.outstanding}
          bondHeld={money.bondHeld}
        />

        {open.length > 0 && (
          // A heading and the panels it names are one group: the gap above the
          // heading is the page's rhythm, the gap below it is not.
          <section className="venue-hire-group">
            {/* Once you settle something it stays in this group rather than
                jumping to the shelf under you, so the heading has to stay true
                after the last one goes quiet. */}
            <div className="st-group" data-clear={stillWanting === 0 || undefined}>
              <h2 className="label-eyebrow">
                {stillWanting > 0 ? (
                  "Still wants you"
                ) : (
                  <>
                    <Check
                      className="st-group-mark"
                      data-drawn={justCleared || undefined}
                      aria-hidden="true"
                    />
                    All in hand
                  </>
                )}
              </h2>
              <span className="st-group-note">
                {stillWanting > 0
                  ? `${stillWanting} of ${board.length}`
                  : "nothing on this hire is waiting on you"}
              </span>
            </div>

            {/* The tick is a mark and the heading is a heading; neither
                interrupts anyone. Somebody who settled the last concern with a
                screen reader on gets told the same thing, once, at the moment it
                becomes true. */}
            <p aria-live="polite" className="sr-only">
              {stillWanting === 0 ? "Nothing on this hire is waiting on you." : ""}
            </p>

            {/* One column. Two-up read well only when both columns happened to
                hold panels of the same height; the moment they did not - a
                three-row payments summary beside a safety panel, which is the
                common case - the short side left a screen of blank paper that
                no balancing could close, because a panel cannot be broken
                across columns. Down the page every panel starts where the one
                above it ended. */}
            <div className="venue-hire-pane">
              {open.map((concern) => (
                <div key={concern.id} className="min-w-0">
                  {panelFor(concern.id)}
                </div>
              ))}
            </div>
          </section>
        )}

        {settled.length > 0 && (
          <section className="venue-hire-group">
            <div className="st-group">
              <h2 className="label-eyebrow">Nothing needed &middot; {settled.length}</h2>
              <span className="st-group-note">open a line to work on it anyway</span>
            </div>

            <VenueHireShelf
              concerns={settled}
              openId={shelfOpenId}
              onOpenChange={setShelfOpenId}
              render={panelFor}
            />
          </section>
        )}
      </div>

      <VenueHireEditorModal
        open={editOpen}
        hire={hire}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setEditOpen}
        onSaved={refresh}
      />

      <VenueBookingModal
        open={bookingModalOpen}
        booking={editingBooking}
        spaces={spaces}
        bookings={allBookings}
        hireId={hire.id}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setBookingModalOpen}
        onSaved={refresh}
      />

      <VenueQuoteLineModal
        open={quoteLineModalOpen}
        line={editingLine}
        resources={resources}
        hireId={hire.id}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setQuoteLineModalOpen}
        onSaved={refresh}
      />

      <VenueRunSheetItemModal
        open={runSheetModalOpen}
        item={editingRunSheetItem}
        spaces={spaces}
        hireId={hire.id}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        defaultStartIso={runSheetSeedIso}
        onOpenChange={setRunSheetModalOpen}
        onSaved={refresh}
      />

      <VenuePositionEditorModal
        open={positionModalOpen}
        position={editingPosition}
        roles={positionRoles}
        hireId={hire.id}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        defaultStartIso={positionSeedIso}
        onOpenChange={setPositionModalOpen}
        onSaved={refresh}
      />

      {assigningPosition && (
        <VenuePositionAssignModal
          open
          positionId={assigningPosition.id}
          roleName={
            positionRoles.find((role) => role.id === assigningPosition.role_id)?.name || "this role"
          }
          people={people}
          workspaceId={workspace?.id || ""}
          userId={user?.id || ""}
          onOpenChange={(open) => !open && setAssigningPosition(null)}
          onSaved={refresh}
        />
      )}

      <VenuePaymentModal
        open={paymentModalOpen}
        payment={editingPayment}
        hireId={hire.id}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setPaymentModalOpen}
        onSaved={refresh}
      />

      {printing === "signs" && (
        <VenueSignPrintSheet
          workspaceName={workspace?.name || ""}
          hireName={hire.name}
          entries={signPlan(hireSignLinks, signs)}
        />
      )}

      <VenueIncidentModal
        open={incidentModalOpen}
        incident={editingIncident}
        spaces={spaces}
        hireId={hire.id}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        reportedBy={user?.email || ""}
        onOpenChange={setIncidentModalOpen}
        onSaved={refresh}
      />

      <VenueTurnaroundTaskModal
        open={turnaroundModalOpen}
        task={editingTurnaroundTask}
        spaces={spaces}
        hireId={hire.id}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        defaultStartIso={span?.endsAt}
        onOpenChange={setTurnaroundModalOpen}
        onSaved={refresh}
      />

      <VenueCloneHireModal
        open={cloneOpen}
        hire={hire}
        source={{
          bookings: hireBookings,
          lines,
          runSheetItems,
          positions,
        }}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setCloneOpen}
      />

      {printing === "contract" && (
        <VenueContractPrintSheet
          workspaceName={workspace?.name || ""}
          logoUrl={workspace?.logo_url}
          hire={hire}
          lines={lines}
          dates={spanLabel}
          spaceNames={[
            ...new Set(
              hireBookings
                .map((booking) => spaces.find((space) => space.id === booking.space_id)?.name)
                .filter((name): name is string => Boolean(name))
            ),
          ]}
        />
      )}

      {printing === "run-sheet" && (
        <VenueRunSheetPrintSheet
          workspaceName={workspace?.name || ""}
          logoUrl={workspace?.logo_url}
          hire={hire}
          items={runSheetItems}
          spaces={spaces}
          positions={positions}
          assignments={assignments}
          roles={positionRoles}
          people={people}
        />
      )}

      {printing === "quote" && (
        <VenueQuotePrintSheet
          workspaceName={workspace?.name || ""}
          logoUrl={workspace?.logo_url}
          hire={hire}
          lines={lines}
          dates={spanLabel}
          paymentTerms={hire.payment_terms}
        />
      )}
    </div>
  );
}
