import { Clock3, FolderKanban, ListChecks, Music, UsersRound } from "lucide-react";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { formatShortDate } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState, WidgetLinkRow } from "./widgetPrimitives";

export function RecentActivityWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 5;
  const items = [
    ...data.tasks.slice(0, 3).map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      meta: task.due ? `Due ${formatShortDate(task.due)}` : "Open task",
      to: "/tasks/next",
      icon: ListChecks,
    })),
    ...data.projects.slice(0, 2).map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      meta: project.status || "Active project",
      to: `/tasks/projects/${project.id}`,
      icon: FolderKanban,
    })),
    ...data.meetings.slice(0, 2).map((meeting) => ({
      id: `meeting-${meeting.id}`,
      title: meeting.title,
      meta: meeting.meeting_date ? formatShortDate(meeting.meeting_date) : "Meeting",
      to: `/meetings/${meeting.id}`,
      icon: UsersRound,
    })),
    ...(data.nextService
      ? [
          {
            id: `service-${data.nextService.id}`,
            title: data.nextService.title || data.nextService.service_types?.name || "Upcoming service",
            meta: formatShortDate(data.nextService.service_date),
            to: `/service-planner/services/${data.nextService.id}`,
            icon: Music,
          },
        ]
      : []),
  ].slice(0, limit);

  if (items.length === 0) return <WidgetEmptyState>No recent activity yet.</WidgetEmptyState>;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <WidgetLinkRow
          key={item.id}
          to={item.to}
          icon={item.icon || Clock3}
          title={item.title}
          meta={<span>{item.meta}</span>}
        />
      ))}
    </div>
  );
}
