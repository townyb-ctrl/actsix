import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardTask } from "@/features/dashboard/types/dashboardTypes";
import { formatShortDate, formatTime } from "@/features/dashboard/utils/dashboardLayoutUtils";

// Every dashboard widget renders through these three primitives, so the Studio
// row language is applied once here rather than in each widget.

export const WidgetEmptyState = ({ children }: { children: string }) => (
  <div className="st-empty">{children}</div>
);

export const DotSeparator = () => (
  <span aria-hidden="true"> · </span>
);

const dueState = (due?: string | null) => {
  if (!due) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${due}T00:00:00`);

  if (dueDate < today) return "late";
  if (dueDate.getTime() === today.getTime()) return "due";
  return "";
};

export const WidgetTaskRow = ({ task }: { task: DashboardTask }) => {
  const state = dueState(task.due);

  return (
    <Link
      to="/tasks/next"
      className={`st-row${state === "late" ? " st-row-late" : ""}${state === "due" ? " st-row-due" : ""}`}
    >
      <span className="st-tick" aria-hidden="true" />
      <span>
        <span className="st-row-title">{task.title}</span>
        <span className="st-row-sub">
          {task.context || task.project || task.priority || "Task"}
        </span>
      </span>
      <span
        className={`st-when${state === "late" ? " st-when-late" : ""}${state === "due" ? " st-when-due" : ""}`}
      >
        {state === "due" ? "Today" : task.due ? formatShortDate(task.due) : "No date"}
      </span>
    </Link>
  );
};

export const WidgetLinkRow = ({
  to,
  icon: Icon,
  title,
  meta,
  trailing,
}: {
  to: string;
  icon: LucideIcon;
  /** Retained for call-site compatibility; Studio colors icons from tokens. */
  iconClassName?: string;
  title: string;
  meta?: ReactNode;
  trailing?: ReactNode;
}) => (
  <Link to={to} className="st-row">
    <Icon className="h-4 w-4" style={{ color: "var(--st-accent)" }} aria-hidden="true" />
    <span>
      <span className="st-row-title">{title}</span>
      {meta && <span className="st-row-sub">{meta}</span>}
    </span>
    {trailing || (
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--st-ink-3)" }} />
    )}
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
    {formatTime(time) && <span> · {formatTime(time)}</span>}
  </>
);
