import { Link } from "react-router-dom";

import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useVenueHires } from "@/features/venues/api/venueHiresQueries";
import { useVenueBookings, useVenueSpaces } from "@/features/venues/api/venuesQueries";
import { hiresToday } from "@/features/venues/lib/venueEventDay";
import { WidgetEmptyState } from "./widgetPrimitives";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Who has the building today.
 *
 * Fetches its own data rather than taking it from the dashboard's shared
 * prefetch: venue rows are wanted by exactly this one widget, and adding them
 * to the shared payload would make every dashboard load pay for them whether
 * the widget is on the board or not.
 */
export function VenueTodayWidget() {
  const { workspace } = useCurrentWorkspace();
  const { hires } = useVenueHires(workspace?.id);
  const { bookings } = useVenueBookings({ workspaceId: workspace?.id });
  const { spaces } = useVenueSpaces(workspace?.id);

  const running = hiresToday(hires, bookings, new Date());

  if (running.length === 0) {
    return <WidgetEmptyState>Nothing booked in today.</WidgetEmptyState>;
  }

  const spaceName = (spaceId: string | null) =>
    spaceId ? spaces.find((space) => space.id === spaceId)?.name || "Unknown space" : "Whole venue";

  return (
    <>
      <div className="st-rows">
        {running.slice(0, 4).map((entry) => (
          <div
            key={entry.hire.id}
            className="st-row"
            style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
          >
            <span className="st-row-title">
              {entry.hire.name}
              <span className="st-row-sub">
                {entry.bookings.map((booking) => spaceName(booking.space_id)).join(", ")}
              </span>
            </span>
            <span className="st-when">{formatTime(entry.startsAt)}</span>
          </div>
        ))}
      </div>

      <div className="st-pad">
        <Link to="/venues/today" className="st-btn st-btn-primary">
          Open today
        </Link>
      </div>
    </>
  );
}
