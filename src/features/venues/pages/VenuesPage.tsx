import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { getVenueBookings, getVenueSpaces } from "@/features/venues/api/venuesApi";
import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";
import VenueBookingList from "@/features/venues/components/VenueBookingList";
import VenueBookingModal from "@/features/venues/components/VenueBookingModal";

type StatusFilter = "All" | "Pending" | "Confirmed" | "Cancelled";

const FILTERS: StatusFilter[] = ["All", "Pending", "Confirmed", "Cancelled"];

export default function VenuesPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();

  const [spaces, setSpaces] = useState<VenueSpace[]>([]);
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [editingBooking, setEditingBooking] = useState<VenueBooking | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    if (!workspace?.id) return;
    setLoading(true);

    const [spacesResult, bookingsResult] = await Promise.all([
      getVenueSpaces(workspace.id),
      getVenueBookings({ workspaceId: workspace.id }),
    ]);

    if (spacesResult.error || bookingsResult.error) {
      toast.error("Could not load venue bookings", {
        description: (spacesResult.error || bookingsResult.error)?.message,
      });
    }

    setSpaces((spacesResult.data as VenueSpace[]) || []);
    setBookings((bookingsResult.data as VenueBooking[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [workspace?.id]);

  const pendingCount = useMemo(
    () => bookings.filter((booking) => booking.status === "Pending").length,
    [bookings]
  );

  const visibleBookings = useMemo(
    () => (filter === "All" ? bookings : bookings.filter((booking) => booking.status === filter)),
    [bookings, filter]
  );

  const activeSpaceCount = useMemo(
    () => spaces.filter((space) => space.is_active).length,
    [spaces]
  );

  const openNewBooking = () => {
    setEditingBooking(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Venue Hire</h1>
          <p className="text-sm text-muted-foreground">
            Who has the building, and when.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/venues/spaces">Spaces</Link>
          </Button>
          <Button onClick={openNewBooking} disabled={activeSpaceCount === 0}>
            <Plus className="mr-2 h-4 w-4" />
            New booking
          </Button>
        </div>
      </div>

      {activeSpaceCount === 0 && !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Add a space first</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Nothing can be booked until the workspace has at least one active bookable space.
            </p>
            <Button asChild>
              <Link to="/venues/spaces">Go to Spaces</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={filter === option ? "default" : "outline"}
                onClick={() => setFilter(option)}
              >
                {option}
                {option === "Pending" && pendingCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading bookings…</p>
          ) : (
            <VenueBookingList
              bookings={visibleBookings}
              spaces={spaces}
              onEdit={(booking) => {
                setEditingBooking(booking);
                setModalOpen(true);
              }}
            />
          )}
        </>
      )}

      <VenueBookingModal
        open={modalOpen}
        booking={editingBooking}
        spaces={spaces}
        bookings={bookings}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setModalOpen}
        onSaved={load}
      />
    </div>
  );
}
