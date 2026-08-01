import { CalendarDays, Clock3, FolderKanban } from "lucide-react";

import {
  formatDate,
  getInitials,
  projectIconClass,
  statusClass,
} from "@/features/projects/lib/projectPresentation";

type RowProject = {
  id: string;
  name: string;
  notes?: string | null;
  area?: string | null;
  status?: string | null;
  is_event?: boolean | null;
  event_start_at?: string | null;
  due_date?: string | null;
};

type RowStats = {
  progress: number;
  openTasks: Array<{ due?: string | null }>;
  nextAction: string;
};

type ProjectTableRowProps = {
  project: RowProject;
  stats?: RowStats;
  ownerName?: string | null;
  /** Drives the rotating icon tint so a list reads as varied. */
  index: number;
  onOpen: () => void;
  statusFallback: string;
  isSelected?: boolean;
  /** Completed rows drop the selection highlight, the next action, and the schedule icons. */
  completed?: boolean;
};

const ProjectTableRow = ({
  project,
  stats,
  ownerName,
  index,
  onOpen,
  statusFallback,
  isSelected = false,
  completed = false,
}: ProjectTableRowProps) => {
  const ownerInitials = getInitials(ownerName || project.name);

  const rowClass = completed
    ? "cursor-pointer border-b border-border/60 bg-background/60 transition-colors hover:bg-muted/30"
    : `border-b border-border/60 cursor-pointer transition-colors ${
        isSelected
          ? "bg-brand-teal/5 shadow-[inset_3px_0_0_hsl(var(--brand-teal))]"
          : "hover:bg-muted/30"
      }`;

  return (
    <tr
      className={rowClass}
      role="button"
      tabIndex={0}
      aria-label={`Open project ${project.name}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <td className="min-w-[260px] px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${projectIconClass(index)}`}
          >
            <FolderKanban className="h-5 w-5" />
          </div>

          <div>
            <div className="font-extrabold tracking-tight">{project.name}</div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {project.notes || "No description yet"}
            </p>
          </div>
        </div>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {project.area || "General"}
      </td>

      <td className="whitespace-nowrap px-4 py-3">
        <span className={`chip ${statusClass(project.status)}`}>
          {project.status || statusFallback}
        </span>
      </td>

      <td className="min-w-[220px] px-4 py-3">
        {completed ? (
          <span className="text-muted-foreground">Complete</span>
        ) : stats?.nextAction ? (
          <div>
            <div className="line-clamp-1 font-semibold">{stats.nextAction}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(stats.openTasks[0]?.due)}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">No next action</span>
        )}
      </td>

      <td className="min-w-[150px] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-teal"
              style={{ width: `${stats?.progress ?? 0}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {stats?.progress ?? 0}%
          </span>
        </div>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">
        {project.is_event && project.event_start_at ? (
          <span className="inline-flex items-center gap-1.5">
            {!completed && <CalendarDays className="h-3.5 w-3.5" />}
            {formatDate(project.event_start_at)}
          </span>
        ) : project.due_date ? (
          <span className="inline-flex items-center gap-1.5">
            {!completed && <Clock3 className="h-3.5 w-3.5" />}
            Due {formatDate(project.due_date)}
          </span>
        ) : (
          "No date"
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
            {ownerInitials}
          </div>
          <span className="max-w-[9rem] truncate text-xs font-semibold text-muted-foreground">
            {ownerName || "Creator"}
          </span>
        </div>
      </td>
    </tr>
  );
};

export default ProjectTableRow;
