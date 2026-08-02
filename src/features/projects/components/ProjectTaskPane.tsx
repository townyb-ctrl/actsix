import { Edit3, ListChecks, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompactTaskRow from "@/components/CompactTaskRow";
import { type PeopleSearchPerson } from "@/components/people/PeopleSearchSelect";
import { type TeamMember } from "@/features/projects/components/CollaboratorAvatars";
import ProjectAddTaskRow, { type NewTaskDraft } from "@/features/projects/components/ProjectAddTaskRow";
import { statusClass } from "@/features/projects/lib/projectPresentation";

export type TaskFilter = "open" | "mine" | "due" | "done" | "all";

const TASK_FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "mine", label: "Mine" },
  { value: "due", label: "Due soon" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

type ProjectTaskPaneProps = {
  heading: string;
  description?: string | null;
  /** Only set when a real section is selected, not the "all tasks" view. */
  status?: string | null;
  leader?: TeamMember | null;
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  counts: Record<TaskFilter, number>;
  search: string;
  onSearchChange: (value: string) => void;
  tasks: any[];
  emptyMessage: string;
  addTargetName: string;
  addPeople: PeopleSearchPerson[];
  onAddTask: (draft: NewTaskDraft) => Promise<void>;
  onToggleTask: (task: any) => void;
  onEditTask: (task: any) => void;
  onDeleteTask: (task: any) => void;
  onEditSection?: () => void;
  onDeleteSection?: () => void;
};

const ProjectTaskPane = ({
  heading,
  description,
  status,
  leader,
  filter,
  onFilterChange,
  counts,
  search,
  onSearchChange,
  tasks,
  emptyMessage,
  addTargetName,
  addPeople,
  onAddTask,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onEditSection,
  onDeleteSection,
}: ProjectTaskPaneProps) => {
  return (
    <div className="actsix-panel min-w-0 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-extrabold leading-tight">{heading}</h2>

            {status && (
              <span className={`chip px-2 py-0.5 text-[10px] ${statusClass(status)}`}>
                {status}
              </span>
            )}
          </div>

          {(leader || description) && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-muted-foreground">
              {leader && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <span className="text-muted-foreground/70">Leader:</span>
                  <span className="max-w-[140px] truncate">{leader.display_name}</span>
                </span>
              )}

              {leader && description && <span className="text-muted-foreground/40">·</span>}

              {description && (
                <span className="min-w-0 truncate font-normal text-muted-foreground/90">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>

        {(onEditSection || onDeleteSection) && (
          <div className="flex shrink-0 items-center gap-1">
            {onEditSection && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                title="Edit section"
                aria-label={`Edit section ${heading}`}
                onClick={onEditSection}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            )}

            {onDeleteSection && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                title="Delete section"
                aria-label={`Delete section ${heading}`}
                onClick={onDeleteSection}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Same control band as the Projects grid: pills left, search right, one
          height, so moving between the two screens feels like one product. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
        <div className="actsix-filter-pills">
          {TASK_FILTERS.map((entry) => {
            const active = filter === entry.value;

            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => onFilterChange(entry.value)}
                className={`actsix-filter-pill ${
                  active ? "actsix-filter-pill-active" : "actsix-filter-pill-idle"
                }`}
              >
                {entry.label}
                <span
                  className={`actsix-filter-pill-count ${
                    active
                      ? "actsix-filter-pill-count-active"
                      : "actsix-filter-pill-count-idle"
                  }`}
                >
                  {counts[entry.value]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="actsix-search-field ml-auto w-36 lg:w-48">
          <Search className="actsix-search-icon" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
            className="actsix-search-input"
          />
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {tasks.length === 0 ? (
          <div className="actsix-empty-state flex min-h-[7rem] flex-col items-center justify-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-teal" />
            {emptyMessage}
          </div>
        ) : (
          tasks.map((task) => (
            <CompactTaskRow
              key={task.id}
              task={task}
              showAssignee
              showProject={false}
              onToggle={onToggleTask}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))
        )}
      </div>

      <div className="mt-1.5">
        <ProjectAddTaskRow
          targetName={addTargetName}
          people={addPeople}
          onAdd={onAddTask}
        />
      </div>
    </div>
  );
};

export default ProjectTaskPane;
