import { useEffect, useMemo, useRef, useState } from "react";
import { PartyPopper, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filter === option ? "default" : "outline"}
              onClick={() => setFilter(option)}
            >
              {option}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading hires…</p>
        ) : visibleHires.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <PartyPopper className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">
                {hires.length === 0 ? "No hires yet" : "Nothing under this filter"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                A hire holds everything about one event — every space, every day, the hirer, and
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
          <div className="space-y-2">
            {visibleHires.map((hire) => {
              const hireBookings = bookingsByHire.get(hire.id) ?? [];
              const span = hireSpan(hireBookings);

              return (
                <Card key={hire.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{hire.name}</p>
                        <Badge variant={statusVariant(hire.status)}>{hire.status}</Badge>
                        {hire.event_type && (
                          <Badge variant="outline" className="font-normal">
                            {hire.event_type}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {span
                          ? `${formatDate(span.startsAt)}${
                              span.dayCount > 1 ? ` · ${span.dayCount} days` : ""
                            }`
                          : "Nothing booked yet"}
                        {hire.hirer_name && ` · ${hire.hirer_name}`}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {hireBookings.length === 1
                          ? "1 booking"
                          : `${hireBookings.length} bookings`}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/venues/hires/${hire.id}`)}
                    >
                      Open
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
