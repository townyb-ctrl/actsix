import { CalendarDays, Clock3, Music } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { formatDate, formatTime } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState } from "./widgetPrimitives";

export function UpcomingServicesWidget({ data }: DashboardWidgetRenderProps) {
  const service = data.nextService;

  if (!service) return <WidgetEmptyState>No upcoming services yet.</WidgetEmptyState>;

  const title = service.title || service.service_types?.name || "Upcoming service";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-brand-teal/15 bg-brand-teal/5 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
            <Music className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-extrabold text-foreground">{title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-brand-teal" />
                {formatDate(service.service_date)}
              </span>
              {formatTime(service.start_time) && (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5 text-brand-teal" />
                  {formatTime(service.start_time)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.serviceOrderItems.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="flex min-h-[42px] items-center justify-between gap-2 rounded-xl border border-border/80 bg-background/70 px-3 py-2"
          >
            <span className="min-w-0 truncate text-sm font-bold">{item.title}</span>
            <span className="shrink-0 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-extrabold capitalize text-brand-teal">
              {item.duration_minutes ? `${item.duration_minutes}m` : item.item_type}
            </span>
          </div>
        ))}
      </div>

      <Button asChild className="actsix-btn-primary h-9 w-full text-xs sm:w-auto">
        <Link to={`/service-planner/services/${service.id}`}>Open Service</Link>
      </Button>
    </div>
  );
}
