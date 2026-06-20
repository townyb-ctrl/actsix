import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardTask } from "@/features/dashboard/types/dashboardTypes";
import {
  formatShortDate,
  formatTime,
  priorityClass,
} from "@/features/dashboard/utils/dashboardLayoutUtils";

export const WidgetEmptyState = ({ children }: { children: string }) => (
  <div className="rounded-xl border border-dashed border-border/65 bg-white px-4 py-5 text-center text-sm font-medium text-muted-foreground">
    {children}
  </div>
);

export const DotSeparator = () => (
  <span aria-hidden="true" className="text-muted-foreground/45">
    /
  </span>
);

export const WidgetTaskRow = ({ task }: { task: DashboardTask }) => (
  <Link
    to="/tasks/next"
    className="group flex min-h-[50px] items-center justify-between gap-3 rounded-xl border border-border/65 bg-white px-4 py-3 transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
  >
    <div className="min-w-0 flex-1">
      <div className="truncate text-[15px] font-extrabold text-foreground group-hover:text-brand-teal">
        {task.title}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-muted-foreground">
        <span>{task.due ? formatShortDate(task.due) : "No due date"}</span>
        {(task.context || task.project) && <DotSeparator />}
        {task.context && <span className="truncate">{task.context}</span>}
        {!task.context && task.project && <span className="truncate">{task.project}</span>}
      </div>
    </div>
    <span
      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-extrabold ${priorityClass(
        task.priority
      )}`}
    >
      {task.priority || "Medium"}
    </span>
  </Link>
);

export const WidgetLinkRow = ({
  to,
  icon: Icon,
  iconClassName = "bg-brand-teal/10 text-brand-teal",
  title,
  meta,
  trailing,
}: {
  to: string;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  meta?: ReactNode;
  trailing?: ReactNode;
}) => (
  <Link
    to={to}
    className="group flex min-h-[52px] items-center gap-3 rounded-xl border border-border/65 bg-white px-4 py-3 transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
  >
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-[15px] font-extrabold text-foreground group-hover:text-brand-teal">
        {title}
      </div>
      {meta && (
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-semibold text-muted-foreground">
          {meta}
        </div>
      )}
    </div>
    {trailing || <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
  </Link>
);

export const WidgetMetaDate = ({
  date,
  time,
  fallback,
}: {
  date?: string | null;
  time?: string | null;
  fallback?: string;
}) => (
  <>
    <span>{date ? formatShortDate(date) : fallback || "No date"}</span>
    {formatTime(time) && <span>{formatTime(time)}</span>}
  </>
);
