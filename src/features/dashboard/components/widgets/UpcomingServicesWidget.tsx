import { Link } from "react-router-dom";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { formatDate, formatTime } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState } from "./widgetPrimitives";

export function UpcomingServicesWidget({ data }: DashboardWidgetRenderProps) {
  const service = data.nextService;

  if (!service) return <WidgetEmptyState>No upcoming services yet.</WidgetEmptyState>;

  const title = service.title || service.service_types?.name || "Upcoming service";
  const assignments = data.serviceTeamAssignments ?? [];

  return (
    <>
      <div className="st-pad" style={{ display: "grid", gap: "12px" }}>
        <div
          className="st-mono"
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--st-accent)",
          }}
        >
          {formatDate(service.service_date)}
          {formatTime(service.start_time) ? ` · ${formatTime(service.start_time)}` : ""}
        </div>

        <h3
          style={{
            margin: 0,
            fontSize: "1.125rem",
            fontWeight: 700,
            letterSpacing: "-0.015em",
            color: "var(--st-ink)",
          }}
        >
          {title}
        </h3>

        {service.location && <p className="st-row-sub">{service.location}</p>}
      </div>

      <div className="st-rows">
        {data.serviceOrderItems.slice(0, 3).map((item) => (
          <div key={item.id} className="st-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <span className="st-row-title">{item.title}</span>
            <span className="st-when">
              {item.duration_minutes ? `${item.duration_minutes}m` : item.item_type}
            </span>
          </div>
        ))}
      </div>

      <div className="st-pad" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <Link to={`/service-planner/services/${service.id}`} className="st-btn st-btn-primary">
          Open service
        </Link>
        {assignments.length > 0 && (
          <span className="st-tally">{assignments.length} on the team</span>
        )}
      </div>
    </>
  );
}
