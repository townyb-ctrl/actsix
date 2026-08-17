import { useEffect, useMemo, useRef, useState } from "react";
import { PartyPopper, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useVenueHires } from "@/features/venues/api/venueHiresQueries";
import { useVenueBookings } from "@/features/venues/api/venuesQueries";
import { hireSpan, VENUE_HIRE_STATUSES, type VenueHireStatus } from "@/features/venues/lib/venueHires";
import VenueHireEditorModal from "@/features/venues/components/VenueHireEditorModal";
import VenueListSkeleton from "@/features/venues/components/VenueListSkeleton";

type StatusFilter = "All" | VenueHireStatus;

const FILTERS: StatusFilter[] = ["All", ...VENUE_HIRE_STATUSES];

const statusVariant = (status: VenueHireStatus) => {
  if (status === "Confirmed") return "default" as const;
  if (status === "Cancelled") return "outline" as const;
  return "secondary" as const;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

export default function VenueHiresPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<StatusFilter>("All");
  const [modalOpen, setModalOpen] = useState(false);

  const { hires, loading: hiresLoading, error } = useVenueHires(workspace?.id);
  // Unwindowed: a hire's bookings can sit anywhere on the calendar, and the
  // span shown on each card has to reflect all of them.
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

  const bookingsByHire = useMemo(() => {
    const grouped = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      if (!booking.hire_id) continue;
      grouped.set(booking.hire_id, [...(grouped.get(booking.hire_id) ?? []), booking]);
    }
    return grouped;
  }, [bookings]);

  const visibleHires = useMemo(
    () => (filter === "All" ? hires : hires.filter((hire) => hire.status === filter)),
    [hires, filter]
  );

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire"
        title="Hires"
        subtitle="One event, however many spaces and days it runs across."
        actions={
          <Button className="actsix-btn-primary min-h-10" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New hire
          </Button>
        }
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
            </button>
          ))}
        </div>

        {loading ? (
          <VenueListSkeleton shape="row" />
        ) : visibleHires.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <PartyPopper className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">
                {hires.length === 0 ? "No hires yet" : "Nothing under this filter"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                A hire holds everything about one event: every space, every day, the hirer, and
                the notes. Single bookings on the calendar carry on working without one.
              </p>
              {hires.length === 0 && (
                <Button className="actsix-btn-primary min-h-10" onClick={() => setModalOpen(true)}>
                  Create your first hire
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="actsix-panel st-list">
            {visibleHires.map((hire) => {
              const hireBookings = bookingsByHire.get(hire.id) ?? [];
              const span = hireSpan(hireBookings);

              return (
                <div key={hire.id} className="action-row flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/venues/hires/${hire.id}`}
                        className="truncate text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
                      >
                        {hire.name}
                      </Link>
                      <Badge variant={statusVariant(hire.status)}>{hire.status}</Badge>
                      {hire.event_type && (
                        <Badge variant="outline" className="font-normal">
                          {hire.event_type}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {span
                        ? `${formatDate(span.startsAt)}${
                            span.dayCount > 1 ? ` · ${span.dayCount} days` : ""
                          }`
                        : "Nothing booked yet"}
                      {hire.hirer_name && ` · ${hire.hirer_name}`}
                    </p>
                  </div>

                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {hireBookings.length === 1 ? "1 booking" : `${hireBookings.length} bookings`}
                  </span>
                </div>
              );
            })}
          </Card>
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
