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
import { toast } from "sonner";
import type { VenueBooking } from "@/features/venues/lib/venueBookings";
import type { VenueQuoteLine, VenueQuoteStatus } from "@/features/venues/lib/venueQuotes";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
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
  const [printing, setPrinting] = useState<"quote" | "run-sheet" | null>(null);

  const { hire, loading } = useVenueHire(hireId);
  const { bookings: hireBookings } = useHireBookings(hireId);
  const { lines } = useQuoteLines(hireId);
  const { items: runSheetItems } = useRunSheet(hireId);
  const { spaces } = useVenueSpaces(workspace?.id);
  const { resources } = useVenueResources(workspace?.id);
  // Every booking in the workspace, so the clash check inside the booking modal
  // sees bookings outside this hire too.
  const { bookings: allBookings } = useVenueBookings({ workspaceId: workspace?.id });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-hire"] });
    queryClient.invalidateQueries({ queryKey: ["venue-hires"] });
    queryClient.invalidateQueries({ queryKey: ["venue-hire-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["venue-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["venue-quote-lines"] });
    queryClient.invalidateQueries({ queryKey: ["venue-run-sheet"] });
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

  const span = hireSpan(hireBookings);
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

        <div className="space-y-4">
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

      {printing === "run-sheet" && (
        <VenueRunSheetPrintSheet
          workspaceName={workspace?.name || ""}
          logoUrl={workspace?.logo_url}
          hire={hire}
          items={runSheetItems}
          spaces={spaces}
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
