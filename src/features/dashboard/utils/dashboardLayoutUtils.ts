import type {
  DashboardWidgetDefinition,
  DashboardProject,
  DashboardTask,
  DashboardWidgetSettings,
  UserDashboardLayout,
  UserDashboardWidget,
  WidgetSize,
} from "@/features/dashboard/types/dashboardTypes";

export const DASHBOARD_LAYOUT_VERSION = 1;

const widgetSizes: WidgetSize[] = ["small", "medium", "large", "full"];

export const createWidgetInstance = (
  definition: DashboardWidgetDefinition,
  settings?: DashboardWidgetSettings
): UserDashboardWidget => ({
  id: `${definition.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  definitionId: definition.id,
  size: definition.defaultSize,
  settings,
});

export const createDashboardLayout = (widgets: UserDashboardWidget[]): UserDashboardLayout => ({
  version: DASHBOARD_LAYOUT_VERSION,
  widgets,
  updatedAt: new Date().toISOString(),
});

export const touchLayout = (layout: UserDashboardLayout): UserDashboardLayout => ({
  ...layout,
  updatedAt: new Date().toISOString(),
});

export const moveWidget = (
  widgets: UserDashboardWidget[],
  widgetId: string,
  direction: "up" | "down"
) => {
  const index = widgets.findIndex((widget) => widget.id === widgetId);
  if (index < 0) return widgets;

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= widgets.length) return widgets;

  const nextWidgets = [...widgets];
  const [widget] = nextWidgets.splice(index, 1);
  nextWidgets.splice(nextIndex, 0, widget);
  return nextWidgets;
};

export const reorderWidgets = (
  widgets: UserDashboardWidget[],
  activeWidgetId: string,
  overWidgetId: string
) => {
  const oldIndex = widgets.findIndex((widget) => widget.id === activeWidgetId);
  const newIndex = widgets.findIndex((widget) => widget.id === overWidgetId);

  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return widgets;

  const nextWidgets = [...widgets];
  const [widget] = nextWidgets.splice(oldIndex, 1);
  nextWidgets.splice(newIndex, 0, widget);
  return nextWidgets;
};

export const resizeWidget = (
  widgets: UserDashboardWidget[],
  widgetId: string,
  size: WidgetSize
) =>
  widgets.map((widget) =>
    widget.id === widgetId
      ? {
          ...widget,
          size,
        }
      : widget
  );

export const getNextWidgetSize = (size: WidgetSize) => {
  const index = widgetSizes.indexOf(size);
  return widgetSizes[(index + 1) % widgetSizes.length];
};

export const normalizeDashboardLayout = (
  layout: UserDashboardLayout | null,
  fallback: UserDashboardLayout,
  definitions: DashboardWidgetDefinition[]
): UserDashboardLayout => {
  if (!layout?.widgets?.length) return fallback;

  const definitionIds = new Set(definitions.map((definition) => definition.id));
  const widgets = layout.widgets.filter((widget) => definitionIds.has(widget.definitionId));

  if (widgets.length === 0) return fallback;

  return {
    version: DASHBOARD_LAYOUT_VERSION,
    widgets,
    updatedAt: layout.updatedAt || new Date().toISOString(),
  };
};

export const priorityWeight: Record<string, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDate = (value?: string | null) => {
  if (!value) return "No date";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export const formatShortDate = (value?: string | null) => {
  if (!value) return "No date";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export const formatTime = (value?: string | null) => {
  if (!value) return null;

  const [hour = "0", minute = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

export const priorityClass = (priority?: string | null) => {
  if (priority === "Urgent") return "bg-brand-danger/10 text-brand-danger border-brand-danger/20";
  if (priority === "High") return "bg-brand-bronze/10 text-brand-bronze border-brand-bronze/20";
  return "bg-brand-teal/10 text-brand-teal border-brand-teal/20";
};

export const projectProgress = (project: DashboardProject, tasks: DashboardTask[]) => {
  const projectTasks = tasks.filter(
    (task) => task.project_id === project.id || (!task.project_id && task.project === project.name)
  );
  const openTasks = projectTasks.filter((task) => !task.complete);
  const completedTasks = projectTasks.filter((task) => task.complete);

  const progress =
    projectTasks.length === 0
      ? project.progress ?? 0
      : Math.round((completedTasks.length / projectTasks.length) * 100);

  return {
    openTasks: projectTasks.length > 0 ? openTasks.length : project.open_tasks || 0,
    progress,
    nextAction: openTasks[0]?.title || project.next_action || "No next action set",
  };
};
