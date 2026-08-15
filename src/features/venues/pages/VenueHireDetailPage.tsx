import { useEffect, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [printing, setPrinting] = useState<"quote" | "run-sheet" | "contract" | null>(null);
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

  const { hire, loading } = useVenueHire(hireId);
  const { bookings: hireBookings } = useHireBookings(hireId);
  const { lines } = useQuoteLines(hireId);
  const { items: runSheetItems } = useRunSheet(hireId);
  const { roles: positionRoles } = usePositionRoles(workspace?.id);
  const { positions } = usePositions(hireId);
  const { assignments } = usePositionAssignments(positions.map((position) => position.id));
  const { people } = usePositionPeople(workspace?.id);
  const { payments } = usePayments(hireId);
  const { tasks: turnaroundTasks } = useTurnaroundTasks(hireId);
  const { walkthroughs } = useWalkthroughs(hireId);
  const { incidents } = useIncidents(hireId);
  const { contacts: hireContacts } = useHireContacts(hireId);
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

  if (loading) {
    return (
      <div className="actsix-page-body pt-8">
        <p className="text-sm text-muted-foreground">Loading hire…</p>
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

      <div className="actsix-page-body grid gap-4 lg:grid-cols-[2fr_1fr]">
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

        <div className="lg:col-start-1 lg:row-start-2">
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
        </div>

        <div className="lg:col-start-1 lg:row-start-3">
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
        </div>

        <div className="lg:col-start-1 lg:row-start-4">
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
        </div>

        <div className="space-y-4 lg:col-start-2 lg:row-start-2">
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
            onPrint={() => setPrinting("contract")}
            onSaved={refresh}
          />

          <VenuePortalPanel hire={hire} onChanged={refresh} />

          <VenueDebriefPanel
            hire={hire}
            lines={lines}
            payments={payments}
            onClone={() => setCloneOpen(true)}
            onSaved={refresh}
          />

          <VenueWalkthroughPanel
            walkthroughs={walkthroughs}
            spaces={spaces}
            hireId={hire.id}
            workspaceId={workspace?.id || ""}
            userId={user?.id || ""}
            walkedBy={user?.email || ""}
            onChanged={refresh}
          />

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
        </div>

        <div className="space-y-4">
          <VenueClashPanel
            bookings={hireBookings}
            events={churchEvents}
            spaces={spaces}
            loading={churchEventsLoading}
            hasSpan={Boolean(span)}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Hire</CardTitle>
              <Badge variant={hire.status === "Confirmed" ? "default" : "secondary"}>
                {hire.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hire.event_type && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Event type</span>
                  <span>{hire.event_type}</span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Bookings</span>
                <span>{hireBookings.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Hirer</p>
                <p>{hire.hirer_name || "Not named"}</p>
                {hire.hirer_email && <p className="text-muted-foreground">{hire.hirer_email}</p>}
                {hire.hirer_phone && <p className="text-muted-foreground">{hire.hirer_phone}</p>}
              </div>

              <div>
                <p className="text-muted-foreground">On site on the day</p>
                <p>{hire.onsite_contact_name || "Not named"}</p>
                {hire.onsite_contact_phone && (
                  <p className="text-muted-foreground">{hire.onsite_contact_phone}</p>
                )}
              </div>

              {hire.enquiry_id && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/venues/enquiries/${hire.enquiry_id}`}>Open the enquiry</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {hire.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{hire.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
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
