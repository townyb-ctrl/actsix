import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useVenueBookings, useVenueSpaces } from "@/features/venues/api/venuesQueries";
import type { VenueBooking } from "@/features/venues/lib/venueBookings";
import VenueBookingList from "@/features/venues/components/VenueBookingList";
import VenueBookingModal from "@/features/venues/components/VenueBookingModal";
import VenueCalendar from "@/features/venues/components/VenueCalendar";
import VenueListSkeleton from "@/features/venues/components/VenueListSkeleton";

type StatusFilter = "All" | "Pending" | "Confirmed" | "Cancelled";

const FILTERS: StatusFilter[] = ["All", "Pending", "Confirmed", "Cancelled"];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

/**
 * The query window is wider than the visible month on both ends: the grid
 * shows leading/trailing days of adjacent months, a booking that starts
 * before the window can still cover a day inside it, and the booking modal's
 * conflict check needs bookings in adjacent months to catch a clash near a
 * month boundary (e.g. a booking on the 31st against one on the 1st). A full
 * month of margin on each side covers all three without falling back to
 * fetching every booking ever. Trade-off: a booking that starts more than a
 * month before the window and is still running when the window opens - or a
 * brand-new booking the user backdates further out than that - won't be
 * fetched, so the conflict check can miss it. Real venue bookings run hours
 * to days, not months, so this is accepted rather than fetching unbounded.
 */
const queryWindowFor = (visibleMonth: Date) => {
  const from = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  const to = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 2, 0, 23, 59, 59, 999);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
};

export default function VenuesPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<StatusFilter>("All");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [editingBooking, setEditingBooking] = useState<VenueBooking | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { fromIso, toIso } = queryWindowFor(visibleMonth);

  const { spaces, loading: spacesLoading, error: spacesError } = useVenueSpaces(workspace?.id);
  const { bookings, loading: bookingsLoading, error: bookingsError } = useVenueBookings({
    workspaceId: workspace?.id,
    fromIso,
    toIso,
  });
  const loading = !workspace?.id || spacesLoading || bookingsLoading;

  const toastedErrorRef = useRef(false);

  useEffect(() => {
    const error = spacesError || bookingsError;
    if (error && !toastedErrorRef.current) {
      toastedErrorRef.current = true;
      toast.error("Could not load venue bookings", { description: error.message });
    }
    if (!error) {
      toastedErrorRef.current = false;
    }
  }, [spacesError, bookingsError]);

  const refreshBookings = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-bookings"] });
  };

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
    <div>
      <PageHeader
        eyebrow="Venue Hire"
        title="Bookings"
        subtitle="Who has the building, and when."
        actions={
          <>
            <Button variant="outline" className="min-h-10" asChild>
              <Link to="/venues/today">Today</Link>
            </Button>
            <Button variant="outline" className="min-h-10" asChild>
              <Link to="/venues/reports">Reports</Link>
            </Button>
            <Button variant="outline" className="min-h-10" asChild>
              <Link to="/venues/signage">Signage</Link>
            </Button>
            <Button variant="outline" className="min-h-10" asChild>
              <Link to="/venues/spaces">Spaces</Link>
            </Button>
            <Button
              className="actsix-btn-primary min-h-10"
              onClick={openNewBooking}
              disabled={activeSpaceCount === 0}
            >
              <Plus className="h-4 w-4" />
              New booking
            </Button>
          </>
        }
      />

      <div className="actsix-page-body actsix-page-stack">
        {activeSpaceCount === 0 && !loading ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Add a space first</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Nothing can be booked until the workspace has at least one active bookable space.
              </p>
              <Button className="actsix-btn-primary min-h-10" asChild>
                <Link to="/venues/spaces">Go to Spaces</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {filter === "Cancelled" ? (
              <p className="text-sm text-muted-foreground">
                Cancelled bookings never occupy the calendar — they're listed below.
              </p>
            ) : (
              <VenueCalendar
                visibleMonth={visibleMonth}
                bookings={visibleBookings}
                spaces={spaces}
                loading={loading}
                onMonthChange={setVisibleMonth}
                onSelectBooking={(booking) => {
                  setEditingBooking(booking);
                  setModalOpen(true);
                }}
              />
            )}

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
                  {option === "Pending" && pendingCount > 0 && (
                    <span className="actsix-filter-pill-count bg-muted">{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>

            {loading ? (
              <VenueListSkeleton />
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
      </div>

      <VenueBookingModal
        open={modalOpen}
        booking={editingBooking}
        spaces={spaces}
        bookings={bookings}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setModalOpen}
        onSaved={refreshBookings}
      />
    </div>
  );
}
