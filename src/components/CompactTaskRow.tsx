import { CalendarDays, Edit3, FolderKanban, RotateCcw, Trash2, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { dueToneClass, getDueTone } from "@/lib/dueDate";
import type { RecurringFrequency } from "@/features/tasks/types/recurringTasks";

type CompactTaskRowProps = {
  task: any;
  showCheckbox?: boolean;
  showAssignee?: boolean;
  showNotes?: boolean;
  /** Off on a project's own page, where naming the project on every row is noise. */
  showProject?: boolean;
  onToggle?: (task: any) => void;
  onEdit?: (task: any) => void;
  onDelete?: (task: any) => void;
};

const formatShortDate = (date?: string | null) => {
  if (!date) return "";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

// Pale/washed pill, matching the low-saturation tag treatment used for
// project and recurring badges rather than full-strength brand color.
const priorityClass = (priority?: string | null) => {
  const clean = priority || "Medium";
  const base = "inline-flex items-center rounded-md border px-1.5 py-0.5 font-semibold";

  if (clean === "Urgent" || clean === "High") {
    return `${base} border-brand-coral/20 bg-brand-coral/5 text-brand-coral`;
  }
  if (clean === "Low") {
    return `${base} border-border/60 bg-transparent text-muted-foreground`;
  }

  return `${base} border-brand-amber/20 bg-brand-amber/5 text-brand-amber`;
};

const getProjectSectionName = (task: any) => {
  const section =
    task.projectSection ||
    task.project_section ||
    task.project_sections ||
    task.section;

  if (Array.isArray(section)) return section[0]?.name || "";
  return section?.name || task.section_name || "";
};

const getRecurringLabel = (task: any) => {
  const template =
    task.recurringTaskTemplate ||
    task.recurring_task_template ||
    task.recurring_task_templates ||
    task.recurring_template;

  const frequency = template?.frequency as RecurringFrequency | undefined;
  const interval = Math.max(1, Number(template?.interval) || 1);

  if (!frequency) return "Recurring";

  const singleLabels: Record<RecurringFrequency, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  };

  if (interval === 1) return singleLabels[frequency];

  const pluralLabels: Record<RecurringFrequency, string> = {
    daily: "days",
    weekly: "weeks",
    monthly: "months",
    quarterly: "quarters",
    yearly: "years",
  };

  return `Every ${interval} ${pluralLabels[frequency]}`;
};

const isSystemCaptureNote = (notes?: string | null) => {
  const clean = notes?.trim().toLowerCase();
  return clean === "captured from whatsapp." || clean === "captured from whatsapp";
};

const CompactTaskRow = ({
  task,
  showCheckbox = true,
  showAssignee = false,
  showNotes = true,
  showProject = true,
  onToggle,
  onEdit,
  onDelete,
}: CompactTaskRowProps) => {
  const { person: currentPerson } = useCurrentPerson();

  if (!task) return null;

  const dueLabel = formatShortDate(task.due);
  const dueTone = getDueTone(task.due);
  const isComplete = Boolean(task.complete);
  const title = task.title || task.item || "Untitled item";
  const displayNotes = isSystemCaptureNote(task.notes) ? "" : task.notes;
  const context = task.context || "General";
  const priority = task.priority || "Medium";
  // 15 is the default the task editor writes when nobody sets an estimate, so
  // it appears on nearly every row and carries no signal — same reason
  // "General" context and "Medium" priority are suppressed below.
  const minutes = task.minutes && task.minutes !== 15 ? task.minutes : 0;
  const isRecurringTask = Boolean(task.recurring_template_id);
  const recurringLabel = getRecurringLabel(task);
  const sectionName = getProjectSectionName(task);
  const projectLabel = showProject
    ? task.project && sectionName
      ? `${task.project}:${sectionName}`
      : task.project
    : sectionName;
  const clickable = Boolean(onEdit);
  const assignedTo =
    task.assignedPersonName ||
    task.assigned_person?.display_name ||
    task.assignee?.display_name ||
    task.assignee ||
    task.assigned_to ||
    "";
  const isAssignedToMe =
    Boolean(task.assigned_person_id) && task.assigned_person_id === currentPerson?.id;
  const assignedLabel = isAssignedToMe ? "ME" : assignedTo;

  // Only surface metadata that carries signal. Defaults ("General" context,
  // "Medium" priority/energy) are the same on most tasks, so rendering them
  // just competes with the task name for attention.
  const contextLabel = context !== "General" ? context : "";
  const priorityLabel = priority !== "Medium" ? priority : "";
  const energyLabel = task.energy && task.energy !== "Medium" ? task.energy : "";
  const hasMeta = Boolean(
    projectLabel ||
      isRecurringTask ||
      contextLabel ||
      priorityLabel ||
      energyLabel ||
      minutes ||
      (showAssignee && assignedLabel)
  );

  const openEditor = () => {
    onEdit?.(task);
  };

  return (
    <div
      className={`action-row group flex items-center gap-2.5 px-3 py-1.5 ${
        clickable ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40" : ""
      } ${
        isComplete ? "opacity-70" : ""
      }`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Edit task: ${title}` : undefined}
      onClick={clickable ? openEditor : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openEditor();
              }
            }
          : undefined
      }
    >
      {showCheckbox && (
        <span onClick={(event) => event.stopPropagation()} className="mt-0.5 shrink-0">
          <Checkbox
            checked={isComplete}
            onCheckedChange={() => onToggle?.(task)}
            aria-label={
              isComplete ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`
            }
          />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`min-w-0 text-[15px] font-bold leading-snug tracking-tight ${
              isComplete ? "line-through text-muted-foreground" : "text-foreground"
            }`}
          >
            {title}
          </div>

          {dueLabel && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dueToneClass[dueTone]}`}
              title={dueTone === "overdue" ? "Overdue" : dueTone === "today" ? "Due today" : "Due date"}
            >
              <CalendarDays className="h-3 w-3" />
              {dueLabel}
            </span>
          )}
        </div>

        {hasMeta && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] leading-none text-muted-foreground">
            {/* Neutral, not teal: this chip repeats on every row, and an accent
                that appears eight times down a list stops meaning "act here". */}
            {projectLabel && (
              <span className="inline-flex max-w-[280px] items-center gap-1 truncate rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-semibold text-muted-foreground">
                <FolderKanban className="h-3 w-3 shrink-0" />
                <span className="truncate">{projectLabel}</span>
              </span>
            )}

            {isRecurringTask && (
              <span className="inline-flex items-center gap-1 rounded-md border border-brand-amber/20 bg-brand-amber/5 px-1.5 py-0.5 font-semibold text-brand-amber">
                <RotateCcw className="h-3 w-3 shrink-0" />
                {recurringLabel}
              </span>
            )}

            {contextLabel && <span>@{contextLabel}</span>}

            {priorityLabel && <span className={priorityClass(priority)}>{priorityLabel}</span>}

            {minutes > 0 && <span className="font-mono">{minutes}m</span>}

            {showAssignee && assignedLabel && (
              <span
                className={`inline-flex max-w-[180px] items-center gap-1 truncate rounded-full px-1.5 py-0.5 font-semibold ${
                  isAssignedToMe
                    ? "bg-brand-teal/10 text-brand-teal"
                    : "bg-brand-sage/10 text-brand-sage"
                }`}
              >
                <UserRound className="h-3 w-3 shrink-0" />
                <span className="truncate">{assignedLabel}</span>
              </span>
            )}

            {energyLabel && <span>{energyLabel} energy</span>}
          </div>
        )}

        {showNotes && displayNotes && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {displayNotes}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 max-sm:min-w-11"
            title={`Edit ${title}`}
            aria-label={`Edit ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(task);
            }}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
        )}

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 max-sm:min-w-11 text-muted-foreground hover:text-destructive"
            title={`Delete ${title}`}
            aria-label={`Delete ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              const confirmed = window.confirm(`Delete "${title}"? This can't be undone.`);
              if (confirmed) onDelete(task);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default CompactTaskRow;
