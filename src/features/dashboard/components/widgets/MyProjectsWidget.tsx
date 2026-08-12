import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { projectProgressByProject } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState } from "./widgetPrimitives";

export function MyProjectsWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 4;

  const statsByProject = useMemo(
    () => projectProgressByProject(data.projects, data.projectTasks),
    [data.projects, data.projectTasks]
  );

  const projects = data.projects
    .filter((project) => !project.status?.toLowerCase().includes("complete"))
    .sort(
      (a, b) =>
        (statsByProject.get(b.id)?.openTasks ?? 0) - (statsByProject.get(a.id)?.openTasks ?? 0)
    )
    .slice(0, limit);

  if (projects.length === 0) return <WidgetEmptyState>No active projects yet.</WidgetEmptyState>;

  return (
    <div className="st-projs">
      {projects.map((project) => {
        const stats = statsByProject.get(project.id)!;
        const progress = Math.min(Math.max(stats.progress, 0), 100);

        return (
          <Link key={project.id} to={`/tasks/projects/${project.id}`} className="st-proj">
            <div className="st-proj-top">
              <span className="st-proj-name">{project.name}</span>
              <span className="st-proj-pct">{progress}%</span>
            </div>
            <div className="st-meter">
              <i style={{ width: `${progress}%` }} />
            </div>
            <p className="st-proj-sub">
              {stats.openTasks} open task{stats.openTasks === 1 ? "" : "s"} · {stats.nextAction}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
