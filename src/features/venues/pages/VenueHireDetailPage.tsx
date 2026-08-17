import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Pencil } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
import { findClashes } from "@/features/venues/lib/venueClashes";
import { paymentSummary } from "@/features/venues/lib/venuePayments";
import { unfilledTotal } from "@/features/venues/lib/venuePositions";
import { incidentSummary } from "@/features/venues/lib/venueSafety";
import { turnaroundProgress, walkthroughCoverage } from "@/features/venues/lib/venueTurnaround";
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
import VenueHireOverviewPanel from "@/features/venues/components/VenueHireOverviewPanel";
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
import VenueHireSectionRail, {
  HIRE_PANE_ID,
  hireTabId,
  type VenueHireSectionId,
} from "@/features/venues/components/VenueHireSectionRail";
import VenueSafetyPanel from "@/features/venues/components/VenueSafetyPanel";
import VenueIncidentModal from "@/features/venues/components/VenueIncidentModal";
import VenueSignagePanel from "@/features/venues/components/VenueSignagePanel";
import VenueSignPrintSheet from "@/features/venues/components/VenueSignPrintSheet";
import VenueListSkeleton from "@/features/venues/components/VenueListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

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

  /**
   * Which section the rail is showing, kept in the URL so a refresh, the back
   * button and a pasted link all land in the same place. A detail page that
   * silently resets to the top has to be re-navigated every single time.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = (searchParams.get("section") as VenueHireSectionId) || "overview";

  const goToSection = (id: VenueHireSectionId) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("section", id);
        return next;
      },
      { replace: true }
    );

  /**
   * Switching sections unmounts the one you were in, and two of them hold long
   * free text somebody typed. Losing three paragraphs of security plan because
   * you looked up a start time is exactly the "punish mistakes" this product
   * says it will not do, so the switch asks first.
   */
  const [unsaved, setUnsaved] = useState<Record<string, string>>({});
  const [pendingSection, setPendingSection] = useState<VenueHireSectionId | null>(null);

  const reportUnsaved = useCallback((key: string, label: string | null) => {
    setUnsaved((current) => {
      if (label === null) {
        if (!(key in current)) return current;
        const { [key]: _removed, ...rest } = current;
        return rest;
      }
      if (current[key] === label) return current;
      return { ...current, [key]: label };
    });
  }, []);

  const unsavedLabels = Object.values(unsaved);

  const selectSection = (id: VenueHireSectionId) => {
    if (id !== activeSection && unsavedLabels.length > 0) {
      setPendingSection(id);
      return;
    }
    goToSection(id);
  };

  const { hire, loading, error: hireError } = useVenueHire(hireId);
  const { bookings: hireBookings, error: bookingsError } = useHireBookings(hireId);
  const { lines, loading: linesLoading, error: linesError } = useQuoteLines(hireId);
  const { items: runSheetItems, error: runSheetError } = useRunSheet(hireId);
  const { roles: positionRoles } = usePositionRoles(workspace?.id);
  const { positions, loading: positionsLoading, error: positionsError } = usePositions(hireId);
  const { assignments } = usePositionAssignments(positions.map((position) => position.id));
  const { people } = usePositionPeople(workspace?.id);
  const { payments, loading: paymentsLoading, error: paymentsError } = usePayments(hireId);
  const {
    tasks: turnaroundTasks,
    loading: turnaroundLoading,
    error: turnaroundError,
  } = useTurnaroundTasks(hireId);
  const { walkthroughs, error: walkthroughsError } = useWalkthroughs(hireId);
  const { incidents, loading: incidentsLoading, error: incidentsError } = useIncidents(hireId);
  const { contacts: hireContacts, error: contactsError } = useHireContacts(hireId);
  const { signs } = useVenueSigns(workspace?.id);
  const { links: hireSignLinks } = useHireSigns(hireId);
  const { presets: avPresets } = useAvPresets(workspace?.id);
  const { checkouts } = useResourceCheckouts(hireId);
  const { clauses: workspaceClauses } = useWorkspaceContractClauses(workspace?.id);
  const { spaces } = useVenueSpaces(workspace?.id);
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

  if (
    loading ||
    linesLoading ||
    paymentsLoading ||
    positionsLoading ||
    incidentsLoading ||
    turnaroundLoading
  ) {
    return (
      <div
        className="actsix-page-body grid min-w-0 gap-3 pt-8 lg:grid-cols-[12rem_minmax(0,1fr)_18rem]"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading the hire…</span>

        {/* The real geometry, so nothing jumps when the hire lands. */}
        <div className="space-y-1">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <span key={row} className="st-skeleton block h-[42px] w-full" />
          ))}
        </div>

        <VenueListSkeleton rows={2} />

        <div className="space-y-3">
          <VenueListSkeleton rows={2} />
        </div>
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
   * fail on its own, and the panels below all render "nothing yet" for an empty
   * list, so a failure has to be said out loud - and the sections it feeds have
   * to stop claiming they are clear.
   */
  const feedFailures = [
    { label: "the bookings", error: bookingsError, section: "dates" as const },
    { label: "the quote", error: linesError, section: "money" as const },
    { label: "the payments", error: paymentsError, section: "money" as const },
    { label: "the run sheet", error: runSheetError, section: "plan" as const },
    { label: "the positions", error: positionsError, section: "plan" as const },
    { label: "the incidents", error: incidentsError, section: "day" as const },
    { label: "the on-the-day contacts", error: contactsError, section: "day" as const },
    { label: "the turnaround tasks", error: turnaroundError, section: "after" as const },
    { label: "the condition walkthrough", error: walkthroughsError, section: "after" as const },
  ].filter((feed) => feed.error);

  const failedSections = new Set(feedFailures.map((feed) => feed.section));

  const failedLabel =
    feedFailures.length === 0
      ? ""
      : feedFailures.length === 1
        ? feedFailures[0].label
        : `${feedFailures
            .slice(0, -1)
            .map((feed) => feed.label)
            .join(", ")} and ${feedFailures[feedFailures.length - 1].label}`;

  /**
   * Rail badges count what somebody still has to do, never what merely exists.
   * A badge that is always lit stops being read.
   */
  const turnaround = turnaroundProgress(turnaroundTasks);
  const railSections = [
    {
      id: "overview" as const,
      name: "Overview",
      // No badge: the four section badges below already count the same problems,
      // and lighting a fifth number for them says nothing new.
      attention: 0,
    },
    {
      id: "dates" as const,
      name: "Dates",
      attention: findClashes(hireBookings, churchEvents).clashes.length,
    },
    {
      id: "money" as const,
      name: "Money",
      // A declined quote is not a debt. Everything else that is owed is - and a
      // contract signed against a draft quote is its own thing to go and fix,
      // which is why this no longer waits for "Accepted".
      attention:
        (hire.quote_status !== "Declined" && paymentSummary(lines, payments).outstanding > 0
          ? 1
          : 0) + (hire.quote_status === "Draft" && hire.contract_signed_on ? 1 : 0),
    },
    {
      id: "plan" as const,
      name: "Plan",
      attention: unfilledTotal(positions, assignments),
    },
    {
      id: "day" as const,
      name: "On the day",
      // Nobody to phone is the failure this section exists to prevent, so it
      // counts the same as an open incident. Both places a contact can be
      // recorded are read, or the badge argues with the sidebar.
      attention:
        incidentSummary(incidents).open +
        (hireContacts.length === 0 && !hire.onsite_contact_name.trim() ? 1 : 0),
    },
    {
      id: "after" as const,
      name: "Afterwards",
      // A missing walkthrough only becomes somebody's problem once the hire is
      // over: before that there is nothing to have walked yet. After it, the
      // bond argument can no longer be won, so it wants a person.
      attention:
        turnaround.total -
        turnaround.done +
        (span &&
        new Date(span.endsAt) < new Date() &&
        !walkthroughCoverage(walkthroughs).bothEndsCaptured
          ? 1
          : 0),
    },
  ];

  const spanLabel = span
    ? `${formatDate(span.startsAt)} – ${formatDate(span.endsAt)}`
    : "";

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire"
        title={hire.name}
        subtitle={
          span
            ? `${formatDate(span.startsAt)} – ${formatDate(span.endsAt)} · ${span.dayCount} ${
                span.dayCount === 1 ? "day" : "days"
              }`
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
            <Button variant="outline" className="min-h-10" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit hire
            </Button>
          </>
        }
      />

      <div className="actsix-page-body grid min-w-0 gap-3 lg:grid-cols-[12rem_minmax(0,1fr)_18rem]">
        <VenueHireSectionRail
          sections={railSections}
          activeId={activeSection}
          onSelect={selectSection}
        />

        <div
          id={HIRE_PANE_ID}
          role="tabpanel"
          aria-labelledby={hireTabId(activeSection)}
          tabIndex={0}
          className="min-w-0 space-y-4 focus-visible:outline-none"
        >
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

          {activeSection === "overview" && (
            <VenueHireOverviewPanel
              hire={hire}
              bookings={hireBookings}
              spaces={spaces}
              lines={lines}
              payments={payments}
              runSheetItems={runSheetItems}
              positions={positions}
              assignments={assignments}
              incidents={incidents}
              contacts={hireContacts}
              turnaroundTasks={turnaroundTasks}
              walkthroughs={walkthroughs}
              failedSections={failedSections}
              onSelect={selectSection}
            />
          )}

          {activeSection === "dates" && (
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
          )}

          {activeSection === "money" && (
            <>
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

              <VenueContractPanel
                hire={hire}
                workspaceClauses={workspaceClauses}
              onUnsavedChange={reportUnsaved}
                onPrint={() => setPrinting("contract")}
                onSaved={refresh}
              />

              <VenuePortalPanel hire={hire} onChanged={refresh} />
            </>
          )}

          {activeSection === "plan" && (
            <>
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
            </>
          )}

          {activeSection === "day" && (
            <>
              <VenueSafetyPanel
                hire={hire}
                incidents={incidents}
                contacts={hireContacts}
                onUnsavedChange={reportUnsaved}
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
            </>
          )}

          {activeSection === "after" && (
            <>
              <VenueWalkthroughPanel
                walkthroughs={walkthroughs}
                spaces={spaces}
                hireId={hire.id}
                workspaceId={workspace?.id || ""}
                userId={user?.id || ""}
                walkedBy={user?.email || ""}
                onChanged={refresh}
              />

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

              <VenueDebriefPanel
                hire={hire}
                lines={lines}
                payments={payments}
                onClone={() => setCloneOpen(true)}
                onSaved={refresh}
              />
            </>
          )}
        </div>

        {/*
          Always on screen, whichever section is open: a clash, the status and
          who to phone are the things somebody needs while looking at anything
          else. Below lg this stacks under the pane rather than competing with it.
        */}
        <aside className="space-y-4">
          <VenueClashPanel
            bookings={hireBookings}
            events={churchEvents}
            spaces={spaces}
            loading={churchEventsLoading}
            hasSpan={Boolean(span)}
          />

          <section className="st-panel" aria-labelledby="hire-facts-heading">
            <div className="st-panel-head">
              <h2 className="st-panel-title" id="hire-facts-heading">
                Hire
              </h2>
              <Badge variant={hire.status === "Confirmed" ? "default" : "secondary"}>
                {hire.status}
              </Badge>
            </div>

            <dl className="space-y-1 px-4 py-3 text-xs">
              {hire.event_type && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Event type</dt>
                  <dd>{hire.event_type}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Bookings</dt>
                <dd className="font-mono tabular-nums">{hireBookings.length}</dd>
              </div>
            </dl>
          </section>

          <section className="st-panel" aria-labelledby="hire-contacts-heading">
            <div className="st-panel-head">
              <h2 className="st-panel-title" id="hire-contacts-heading">
                Contacts
              </h2>
            </div>

            {/* Phone numbers are the reason somebody opens this card while
                standing in the building, so they dial rather than get read out. */}
            <div className="action-row">
              <p className="label-eyebrow">Hirer</p>
              <p className="mt-1 text-sm font-semibold">{hire.hirer_name || "Not named"}</p>
              {hire.hirer_email && (
                <a
                  href={`mailto:${hire.hirer_email}`}
                  className="mt-0.5 block truncate text-xs underline"
                >
                  {hire.hirer_email}
                </a>
              )}
              {hire.hirer_phone && (
                <a
                  href={`tel:${hire.hirer_phone}`}
                  className="mt-0.5 block font-mono text-xs tabular-nums underline"
                >
                  {hire.hirer_phone}
                </a>
              )}
            </div>

            <div className="action-row">
              <p className="label-eyebrow">On site on the day</p>
              <p className="mt-1 text-sm font-semibold">
                {hire.onsite_contact_name || "Not named"}
              </p>
              {hire.onsite_contact_phone && (
                <a
                  href={`tel:${hire.onsite_contact_phone}`}
                  className="mt-0.5 block font-mono text-xs tabular-nums underline"
                >
                  {hire.onsite_contact_phone}
                </a>
              )}
            </div>

            {hire.enquiry_id && (
              <div className="px-4 py-3">
                <Button variant="outline" size="sm" className="min-h-9" asChild>
                  <Link to={`/venues/enquiries/${hire.enquiry_id}`}>Open the enquiry</Link>
                </Button>
              </div>
            )}
          </section>

          {(hire.hirer_notes || hire.notes) && (
            <section className="st-panel" aria-labelledby="hire-notes-heading">
              <div className="st-panel-head">
                <h2 className="st-panel-title" id="hire-notes-heading">
                  Notes
                </h2>
              </div>

              {/* Which of these the hirer can read is the first thing to know
                  about them, so it is stated on the note, not in a tooltip. */}
              {hire.hirer_notes && (
                <div className="action-row">
                  <Badge
                    variant="outline"
                    className="border-brand-teal/25 bg-brand-teal/8 text-brand-teal"
                  >
                    They see this
                  </Badge>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{hire.hirer_notes}</p>
                </div>
              )}

              {hire.notes && (
                <div className="action-row">
                  <Badge
                    variant="outline"
                    className="border-brand-amber/30 bg-brand-amber/10 text-brand-amber"
                  >
                    Staff only
                  </Badge>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{hire.notes}</p>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={pendingSection !== null}
        title="Leave without saving?"
        description={`${unsavedLabels.join(" and ")} ${
          unsavedLabels.length === 1 ? "has" : "have"
        } changes you have not saved yet. Leaving this section discards them.`}
        confirmLabel="Discard and leave"
        onConfirm={() => {
          const target = pendingSection;
          setPendingSection(null);
          setUnsaved({});
          if (target) goToSection(target);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingSection(null);
        }}
      />

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
