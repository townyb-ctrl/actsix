import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { priorityWeight } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState, WidgetTaskRow } from "./widgetPrimitives";

export function TodaysTasksWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 5;
  const tasks = data.tasks
    .filter((task) => task.due === data.todayKey)
    .sort(
      (a, b) =>
        (priorityWeight[b.priority || "Medium"] || 0) -
        (priorityWeight[a.priority || "Medium"] || 0)
    )
    .slice(0, limit);

  if (tasks.length === 0) return <WidgetEmptyState>No tasks due today.</WidgetEmptyState>;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <WidgetTaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
