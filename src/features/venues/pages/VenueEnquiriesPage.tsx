import { useEffect, useMemo, useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useVenueEnquiries } from "@/features/venues/api/venueEnquiriesQueries";
import { useVenueSpaces } from "@/features/venues/api/venuesQueries";
import {
  spaceNamesForEnquiry,
  VENUE_ENQUIRY_STATUSES,
  vettingProgress,
  type VenueEnquiry,
  type VenueEnquiryStatus,
} from "@/features/venues/lib/venueEnquiries";
import VenueListSkeleton from "@/features/venues/components/VenueListSkeleton";

type StatusFilter = "Open" | "All" | VenueEnquiryStatus;

/** "Open" is the working view - everything still needing a decision. */
const OPEN_STATUSES: VenueEnquiryStatus[] = ["New", "In review", "Awaiting info"];

const FILTERS: StatusFilter[] = ["Open", ...VENUE_ENQUIRY_STATUSES, "All"];

const statusVariant = (status: VenueEnquiryStatus) => {
  if (status === "Accepted") return "default" as const;
  if (status === "Declined") return "outline" as const;
  return "secondary" as const;
};

const formatReceived = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

const formatPreferred = (enquiry: VenueEnquiry) => {
  if (!enquiry.preferred_start) return "No date given";
  return new Date(enquiry.preferred_start).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function VenueEnquiriesPage() {
  const { workspace } = useCurrentWorkspace();

  const [filter, setFilter] = useState<StatusFilter>("Open");

  const { enquiries, loading: enquiriesLoading, error } = useVenueEnquiries(workspace?.id);
  const { spaces } = useVenueSpaces(workspace?.id);
  const loading = !workspace?.id || enquiriesLoading;

  const toastedErrorRef = useRef(false);

  useEffect(() => {
    if (error && !toastedErrorRef.current) {
      toastedErrorRef.current = true;
      toast.error("Could not load enquiries", { description: error.message });
    }
    if (!error) {
      toastedErrorRef.current = false;
    }
  }, [error]);

  const openCount = useMemo(
    () => enquiries.filter((enquiry) => OPEN_STATUSES.includes(enquiry.status)).length,
    [enquiries]
  );

  const visibleEnquiries = useMemo(() => {
    if (filter === "All") return enquiries;
    if (filter === "Open") {
      return enquiries.filter((enquiry) => OPEN_STATUSES.includes(enquiry.status));
    }
    return enquiries.filter((enquiry) => enquiry.status === filter);
  }, [enquiries, filter]);

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire"
        title="Enquiries"
        subtitle="Who wants the building, and whether we should say yes."
      />

      <div className="actsix-page-body actsix-page-stack">
        <div className="actsix-filter-pills">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              className={`actsix-filter-pill ${
                filter === option ? "actsix-filter-pill-active" : "actsix-filter-pill-idle"
              }`}
              onClick={() => setFilter(option)}
            >
              {option}
              {option === "Open" && openCount > 0 && (
                <span className="actsix-filter-pill-count bg-muted">{openCount}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <VenueListSkeleton />
        ) : visibleEnquiries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">
                {enquiries.length === 0 ? "No enquiries yet" : "Nothing under this filter"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {enquiries.length === 0
                  ? "Turn on the public request link under Spaces, and enquiries from your website land here."
                  : "Try another status."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {visibleEnquiries.map((enquiry) => {
              const progress = vettingProgress(enquiry);
              const spaceNames = spaceNamesForEnquiry(enquiry, spaces);

              return (
                <Card key={enquiry.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{enquiry.event_name}</p>
                        <Badge variant={statusVariant(enquiry.status)}>{enquiry.status}</Badge>
                        {enquiry.event_type && (
                          <Badge variant="outline" className="font-normal">
                            {enquiry.event_type}
                          </Badge>
                        )}
                        {enquiry.is_for_profit && <Badge variant="outline">For profit</Badge>}
                        {enquiry.is_ticketed && <Badge variant="outline">Ticketed</Badge>}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {enquiry.contact_name} · {formatPreferred(enquiry)}
                        {spaceNames.length > 0 && ` · ${spaceNames.join(", ")}`}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        Received {formatReceived(enquiry.created_at)} · vetting{" "}
                        {progress.completed}/{progress.total}
                      </p>
                    </div>

                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/venues/enquiries/${enquiry.id}`}>Open</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
