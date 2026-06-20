import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { priorityWeight } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState, WidgetTaskRow } from "./widgetPrimitives";

export function TodaysTasksWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 5;
  const tasks = data.tasks
    .filter((task) => {
      const priority = priorityWeight[task.priority || "Medium"] || 0;
      return !task.due || task.due <= data.todayKey || priority >= priorityWeight.High;
    })
    .sort((a, b) => {
      const aDue = a.due || "9999-12-31";
      const bDue = b.due || "9999-12-31";
      if (aDue !== bDue) return aDue.localeCompare(bDue);

      return (
        (priorityWeight[b.priority || "Medium"] || 0) -
        (priorityWeight[a.priority || "Medium"] || 0)
      );
    })
    .slice(0, limit);

  if (tasks.length === 0) return <WidgetEmptyState>No next actions need attention.</WidgetEmptyState>;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <WidgetTaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
