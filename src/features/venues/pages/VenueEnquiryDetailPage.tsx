import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { setVenueEnquiryStatus } from "@/features/venues/api/venueEnquiriesApi";
import {
  useVenueEnquiry,
  useVenueReplyTemplates,
} from "@/features/venues/api/venueEnquiriesQueries";
import { useVenueBookings, useVenueSpaces } from "@/features/venues/api/venuesQueries";
import { spaceNamesForEnquiry, type VenueEnquiry } from "@/features/venues/lib/venueEnquiries";
import VenueEnquiryVettingCard from "@/features/venues/components/VenueEnquiryVettingCard";
import VenueEnquiryReplyModal from "@/features/venues/components/VenueEnquiryReplyModal";
import VenueEnquiryConvertModal from "@/features/venues/components/VenueEnquiryConvertModal";

const formatDateTime = (iso: string | null) => {
  if (!iso) return "Not given";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="grid gap-1 border-b border-border/50 py-2 last:border-0 sm:grid-cols-[10rem_1fr]">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="whitespace-pre-wrap text-sm">{value || "—"}</dd>
  </div>
);

export default function VenueEnquiryDetailPage() {
  const { enquiryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const [replyKind, setReplyKind] = useState<"Decline" | "More info" | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);

  const { enquiry, loading } = useVenueEnquiry(enquiryId);
  const { spaces } = useVenueSpaces(workspace?.id);
  const { bookings } = useVenueBookings({ workspaceId: workspace?.id });
  const { templates } = useVenueReplyTemplates(workspace?.id);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-enquiry"] });
    queryClient.invalidateQueries({ queryKey: ["venue-enquiries"] });
    queryClient.invalidateQueries({ queryKey: ["venue-reply-templates"] });
    queryClient.invalidateQueries({ queryKey: ["venue-bookings"] });
  };

  const markInReview = async (target: VenueEnquiry) => {
    const { error } = await setVenueEnquiryStatus({ enquiryId: target.id, status: "In review" });
    if (error) {
      toast.error("Could not update the enquiry", { description: error.message });
      return;
    }
    refresh();
  };

  if (loading) {
    return (
      <div className="actsix-page-body pt-8">
        <p className="text-sm text-muted-foreground">Loading enquiry…</p>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="actsix-page-body pt-8">
        <p className="text-sm text-muted-foreground">
          This enquiry no longer exists.{" "}
          <Link to="/venues/enquiries" className="underline">
            Back to enquiries
          </Link>
          .
        </p>
      </div>
    );
  }

  const spaceNames = spaceNamesForEnquiry(enquiry, spaces);
  const isClosed = enquiry.status === "Accepted" || enquiry.status === "Declined";

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire Enquiry"
        title={enquiry.event_name}
        subtitle={`${enquiry.contact_name} · ${enquiry.contact_email}`}
        actions={
          <>
            <Button variant="outline" className="min-h-10" asChild>
              <Link to="/venues/enquiries">
                <ArrowLeft className="h-4 w-4" />
                Enquiries
              </Link>
            </Button>

            {!isClosed && (
              <>
                {enquiry.status === "New" && (
                  <Button variant="outline" className="min-h-10" onClick={() => markInReview(enquiry)}>
                    Start reviewing
                  </Button>
                )}
                <Button variant="outline" className="min-h-10" onClick={() => setReplyKind("More info")}>
                  Ask for more
                </Button>
                <Button variant="outline" className="min-h-10" onClick={() => setReplyKind("Decline")}>
                  Decline
                </Button>
                <Button
                  className="actsix-btn-primary min-h-10"
                  onClick={() => setConvertOpen(true)}
                  disabled={spaces.filter((space) => space.is_active).length === 0}
                >
                  Accept
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="actsix-page-body grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">The enquiry</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Badge variant={enquiry.status === "Accepted" ? "default" : "secondary"}>
                  {enquiry.status}
                </Badge>
                <Badge variant="outline">{enquiry.source === "public" ? "From website" : "Added by staff"}</Badge>
              </div>
            </CardHeader>

            <CardContent>
              <dl>
                <DetailRow label="Event type" value={enquiry.event_type} />
                <DetailRow label="Organisation" value={enquiry.organisation} />
                <DetailRow
                  label="Commercial"
                  value={[
                    enquiry.is_for_profit ? "For profit" : "Not for profit",
                    enquiry.is_ticketed ? "Selling tickets" : "No tickets",
                  ].join(" · ")}
                />
                <DetailRow
                  label="Expected attendance"
                  value={enquiry.expected_attendance != null ? String(enquiry.expected_attendance) : ""}
                />
                <DetailRow label="Preferred start" value={formatDateTime(enquiry.preferred_start)} />
                <DetailRow label="Preferred end" value={formatDateTime(enquiry.preferred_end)} />
                <DetailRow label="Alternative dates" value={enquiry.alternate_dates} />
                <DetailRow label="Setup / pack-down" value={enquiry.setup_notes} />
                <DetailRow label="Spaces wanted" value={spaceNames.join(", ")} />
                <DetailRow label="What they want to run" value={enquiry.description} />
                <DetailRow label="AV needs" value={enquiry.av_needs} />
                <DetailRow label="Catering" value={enquiry.catering_plan} />
                <DetailRow label="Insurance" value={enquiry.insurance_status} />
                <DetailRow label="How they found us" value={enquiry.heard_about} />
                <DetailRow label="Phone" value={enquiry.contact_phone} />
              </dl>
            </CardContent>
          </Card>

          {enquiry.decline_reason && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {enquiry.status === "Declined" ? "Why this was declined" : "What we asked for"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{enquiry.decline_reason}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Saved here only — send it to the hirer yourself.
                </p>
              </CardContent>
            </Card>
          )}

          {enquiry.converted_booking_id && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-sm">This enquiry became a booking.</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/venues")}>
                  Open bookings
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <VenueEnquiryVettingCard enquiry={enquiry} onSaved={refresh} />
      </div>

      {replyKind && (
        <VenueEnquiryReplyModal
          open
          kind={replyKind}
          enquiry={enquiry}
          templates={templates}
          workspaceId={workspace?.id || ""}
          userId={user?.id || ""}
          onOpenChange={(open) => !open && setReplyKind(null)}
          onSaved={refresh}
        />
      )}

      <VenueEnquiryConvertModal
        open={convertOpen}
        enquiry={enquiry}
        spaces={spaces}
        bookings={bookings}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setConvertOpen}
        onSaved={refresh}
      />
    </div>
  );
}
