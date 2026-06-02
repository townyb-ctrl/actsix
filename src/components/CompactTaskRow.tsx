import { CalendarDays, Edit3, FolderKanban, Trash2, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";

type CompactTaskRowProps = {
  task: any;
  showCheckbox?: boolean;
  showAssignee?: boolean;
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

const priorityClass = (priority?: string | null) => {
  const clean = priority || "Medium";

  if (clean === "Urgent") return "text-brand-coral font-bold";
  if (clean === "High") return "text-brand-coral font-semibold";
  if (clean === "Low") return "text-muted-foreground";

  return "text-brand-amber font-semibold";
};

const CompactTaskRow = ({
  task,
  showCheckbox = true,
  showAssignee = false,
  onToggle,
  onEdit,
  onDelete,
}: CompactTaskRowProps) => {
  const { person: currentPerson } = useCurrentPerson();

  if (!task) return null;

  const dueLabel = formatShortDate(task.due);
  const isComplete = Boolean(task.complete);
  const title = task.title || task.item || "Untitled item";
  const context = task.context || "General";
  const priority = task.priority || "Medium";
  const minutes = task.minutes || 15;
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

  const openEditor = () => {
    onEdit?.(task);
  };

  return (
    <div
      className={`action-row group flex items-start gap-3 px-3.5 py-2.5 ${
        clickable ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40" : ""
      } ${
        isComplete ? "opacity-70" : ""
      }`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
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
          />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`min-w-0 text-sm font-semibold leading-snug ${
              isComplete ? "line-through text-muted-foreground" : "text-foreground"
            }`}
          >
            {title}
          </div>

          {dueLabel && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-coral/20 bg-brand-coral/10 px-2 py-0.5 text-[11px] font-bold text-brand-coral">
              <CalendarDays className="h-3 w-3" />
              {dueLabel}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-none">
          {task.project && (
            <span className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border border-brand-teal/20 bg-brand-teal/10 px-2 py-1 font-semibold text-brand-teal">
              <FolderKanban className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.project}</span>
            </span>
          )}

          <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2 py-1 font-semibold text-muted-foreground">
            @{context}
          </span>

          <span className="text-muted-foreground">·</span>

          <span className={priorityClass(priority)}>{priority}</span>

          <span className="text-muted-foreground">·</span>

          <span className="font-mono text-muted-foreground">{minutes}m</span>

          {showAssignee && assignedLabel && (
            <>
              <span className="text-muted-foreground">Â·</span>
              <span
                className={`inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border px-2 py-1 font-semibold ${
                  isAssignedToMe
                    ? "border-brand-teal/40 bg-brand-teal text-white shadow-sm"
                    : "border-brand-sage/20 bg-brand-sage/10 text-brand-sage"
                }`}
              >
                <UserRound className="h-3 w-3 shrink-0" />
                <span className="truncate">{assignedLabel}</span>
              </span>
            </>
          )}

          {task.energy && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{task.energy} energy</span>
            </>
          )}
        </div>

        {task.notes && (
          <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
            {task.notes}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Edit"
            aria-label="Edit"
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
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete"
            aria-label="Delete"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(task);
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
