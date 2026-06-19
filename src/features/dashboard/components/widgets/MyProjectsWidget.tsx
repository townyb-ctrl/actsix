import { Link } from "react-router-dom";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { projectProgress } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState } from "./widgetPrimitives";

export function MyProjectsWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 4;
  const projects = data.projects
    .filter((project) => !project.status?.toLowerCase().includes("complete"))
    .sort((a, b) => {
      const aStats = projectProgress(a, data.projectTasks);
      const bStats = projectProgress(b, data.projectTasks);
      return bStats.openTasks - aStats.openTasks;
    })
    .slice(0, limit);

  if (projects.length === 0) return <WidgetEmptyState>No active projects yet.</WidgetEmptyState>;

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const stats = projectProgress(project, data.projectTasks);
        const progress = Math.min(Math.max(stats.progress, 0), 100);

        return (
          <Link
            key={project.id}
            to={`/tasks/projects/${project.id}`}
            className="group block rounded-xl border border-border/80 bg-background/70 p-3 transition hover:border-brand-teal/35 hover:bg-brand-teal/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold text-foreground group-hover:text-brand-teal">
                  {project.name}
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-muted-foreground">
                  {stats.nextAction}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-extrabold text-brand-teal">
                {progress}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-teal" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs font-bold text-muted-foreground">
              {stats.openTasks} open task{stats.openTasks === 1 ? "" : "s"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
