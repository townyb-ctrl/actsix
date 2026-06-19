import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { priorityWeight } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState, WidgetTaskRow } from "./widgetPrimitives";

export function OverdueTasksWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 5;
  const tasks = data.tasks
    .filter((task) => task.due && task.due < data.todayKey)
    .sort((a, b) => {
      const priorityDiff =
        (priorityWeight[b.priority || "Medium"] || 0) -
        (priorityWeight[a.priority || "Medium"] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return String(a.due).localeCompare(String(b.due));
    })
    .slice(0, limit);

  if (tasks.length === 0) return <WidgetEmptyState>No overdue tasks.</WidgetEmptyState>;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <WidgetTaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
