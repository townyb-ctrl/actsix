import { CalendarDays, FolderKanban } from "lucide-react";

import { projectIconClass, statusClass } from "@/features/projects/lib/projectPresentation";

type SummaryProject = {
  id: string;
  name: string;
  area?: string | null;
  status?: string | null;
};

type SummaryStats = {
  progress: number;
  openTasks: Array<{ due?: string | null }>;
  nextAction: string;
};

type ProjectSummaryCardProps = {
  project: SummaryProject;
  stats?: SummaryStats;
  ownerName?: string | null;
  /** Drives the rotating icon tint so a list reads as varied. */
  index: number;
  onOpen: () => void;
  statusFallback: string;
  formatDate: (date?: string | null) => string;
  /** Completed projects omit the next action and open-task count. */
  showNextAction?: boolean;
};

const ProjectSummaryCard = ({
  project,
  stats,
  ownerName,
  index,
  onOpen,
  statusFallback,
  formatDate,
  showNextAction = true,
}: ProjectSummaryCardProps) => (
  <button
    type="button"
    onClick={onOpen}
    className="actsix-interactive-tile w-full p-3.5"
  >
    <div className="flex min-w-0 items-start gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${projectIconClass(index)}`}
      >
        <FolderKanban className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 text-left">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold tracking-tight">{project.name}</h2>
            <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
              {project.area || "General"} · {ownerName || "Creator"}
            </p>
          </div>

          <span className={`chip shrink-0 ${statusClass(project.status)}`}>
            {project.status || statusFallback}
          </span>
        </div>

        {showNextAction && (
          <div className="actsix-interactive-row mt-2.5 border-border/60 bg-background/60 p-2.5">
            <p className="label-eyebrow">Next Action</p>
            <p className="mt-1 line-clamp-2 text-sm font-bold text-foreground">
              {stats?.nextAction || "No next action set"}
            </p>
            {stats?.openTasks[0]?.due && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(stats.openTasks[0].due)}
              </p>
            )}
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-teal"
              style={{ width: `${stats?.progress ?? 0}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-extrabold text-muted-foreground">
            {stats?.progress ?? 0}%
          </span>
          {showNextAction && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground">
              {stats?.openTasks.length ?? 0} open
            </span>
          )}
        </div>
      </div>
    </div>
  </button>
);

export default ProjectSummaryCard;
