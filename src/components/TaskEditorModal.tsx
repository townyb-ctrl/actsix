import {
  Archive,
  FileText,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import NextActionFields from "@/components/NextActionFields";

type TaskEditorModalProps = {
  task: any;
  saving?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  saveLabel?: string;
  onChange: (task: any) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onRefreshOptions?: () => void | Promise<void>;
};

const TaskEditorModal = ({
  task,
  saving = false,
  eyebrow = "Edit Next Action",
  title = "Task details",
  description = "Edit this task using the shared ACTSIX task editor.",
  saveLabel = "Save changes",
  onChange,
  onClose,
  onSave,
  onDelete,
  onRefreshOptions,
}: TaskEditorModalProps) => {
  if (!task) return null;

  const titleId = "task-editor-title";
  const descriptionId = "task-editor-description";
  const destinationId = "task-editor-destination";
  const taskTitleId = "task-editor-task-title";
  const notesId = "task-editor-notes";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <Card className="flex max-h-[92svh] w-full max-w-4xl flex-col overflow-hidden rounded-b-none border-border/70 bg-card shadow-card sm:h-[88vh] sm:rounded-[var(--radius-overlay)]">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="label-eyebrow">{eyebrow}</p>
            <h2 id={titleId} className="mt-1 text-xl font-extrabold leading-tight">
              {title}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          </div>

          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={onClose} aria-label="Close task editor">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Archive className="h-4 w-4 text-brand-teal" />
              <h3 className="font-extrabold">Destination</h3>
            </div>

            <div className="actsix-interactive-row border-brand-teal/25 bg-brand-teal/5 p-3">
              <label htmlFor={destinationId} className="label-eyebrow">Where does this belong?</label>
              <select
                id={destinationId}
                value="task"
                disabled
                className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm opacity-80"
              >
                <option value="task">Next Action</option>
              </select>

              <p className="mt-2 text-xs text-muted-foreground">
                This item is already a Next Action.
              </p>
            </div>
          </section>

          <section className="grid gap-3">
            <div className="actsix-interactive-row bg-background/45 p-3">
              <label htmlFor={taskTitleId} className="label-eyebrow">Title</label>
              <Input
                id={taskTitleId}
                value={task.title ?? ""}
                onChange={(event) =>
                  onChange({ ...task, title: event.target.value })
                }
                className="mt-2 border-border/70 bg-background"
                placeholder="What needs to be done?"
              />
            </div>

            <div className="actsix-interactive-row bg-background/45 p-3">
              <label htmlFor={notesId} className="label-eyebrow flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Notes
              </label>
              <textarea
                id={notesId}
                value={task.notes ?? ""}
                onChange={(event) =>
                  onChange({ ...task, notes: event.target.value })
                }
                className="mt-2 min-h-28 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Add details, links, thoughts, or next-step context..."
              />
            </div>
          </section>

          <NextActionFields
            item={task}
            onChange={onChange}
            onRefreshOptions={onRefreshOptions}
          />

          <section className="actsix-interactive-row bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold">Advanced</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Created:{" "}
                  {task.created_at
                    ? new Date(task.created_at).toLocaleDateString()
                    : "Unknown"}
                </p>
              </div>

              {onDelete && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete task
                </Button>
              )}
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-card/95 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Save changes to update this Next Action.
          </p>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button variant="outline" className="actsix-btn-outline" onClick={onClose}>
              Cancel
            </Button>

            <Button
              disabled={saving}
              variant="outline"
              className="actsix-btn-outline border-brand-teal/50 font-bold text-brand-teal hover:text-brand-teal"
              onClick={onSave}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : saveLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TaskEditorModal;
