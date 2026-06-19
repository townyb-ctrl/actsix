import { UsersRound } from "lucide-react";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { WidgetEmptyState, WidgetLinkRow, WidgetMetaDate } from "./widgetPrimitives";

export function PeopleFollowupsWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 5;
  const followups = data.tasks
    .filter((task) => {
      const text = `${task.title} ${task.context || ""} ${task.project || ""}`.toLowerCase();
      return text.includes("follow") || text.includes("call") || text.includes("check in");
    })
    .slice(0, limit);

  if (followups.length === 0) return <WidgetEmptyState>No follow-ups waiting.</WidgetEmptyState>;

  return (
    <div className="space-y-3">
      {followups.map((task) => (
        <WidgetLinkRow
          key={task.id}
          to="/tasks/next"
          icon={UsersRound}
          iconClassName="bg-brand-sage/10 text-brand-sage"
          title={task.title}
          meta={<WidgetMetaDate date={task.due} fallback="Follow-up" />}
        />
      ))}
    </div>
  );
}
