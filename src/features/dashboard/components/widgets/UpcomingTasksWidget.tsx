import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { addDays, toDateKey } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState, WidgetTaskRow } from "./widgetPrimitives";

export function UpcomingTasksWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 5;
  const endKey = toDateKey(addDays(new Date(`${data.todayKey}T00:00:00`), 14));
  const tasks = data.tasks
    .filter((task) => task.due && task.due > data.todayKey && task.due <= endKey)
    .sort((a, b) => String(a.due).localeCompare(String(b.due)))
    .slice(0, limit);

  if (tasks.length === 0) return <WidgetEmptyState>No upcoming tasks.</WidgetEmptyState>;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <WidgetTaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
