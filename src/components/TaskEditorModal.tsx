import { useEffect, useState } from "react";
import { Save, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import NextActionFields from "@/components/NextActionFields";

type TaskEditorModalProps = {
  task: any;
  saving?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  saveLabel?: string;
  projectSections?: Array<{
    id: string;
    name: string;
    status?: string | null;
  }>;
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
  projectSections,
  onChange,
  onClose,
  onSave,
  onDelete,
  onRefreshOptions,
}: TaskEditorModalProps) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!task) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [task, onClose]);

  if (!task) return null;

  const titleId = "task-editor-title";
  const descriptionId = "task-editor-description";
  const sectionId = "task-editor-project-section";
  const taskTitleId = "task-editor-task-title";
  const notesId = "task-editor-notes";
  const canChooseProjectSection = Boolean(projectSections);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/35 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <Card className="actsix-panel flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-b-none sm:max-h-[88vh] sm:rounded-[var(--radius-overlay)]">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 p-4">
          <div className="min-w-0">
            <p className="label-eyebrow text-[0.65rem]">{eyebrow}</p>
            <h2 id={titleId} className="text-lg font-extrabold leading-tight">
              {title}
            </h2>
            <p id={descriptionId} className="sr-only">
              {description}
            </p>
          </div>

          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={onClose} aria-label="Close task editor">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <section className="space-y-2.5">
            <div className="space-y-1">
              <label htmlFor={taskTitleId} className="label-eyebrow text-[0.65rem]">Title</label>
              <Input
                id={taskTitleId}
                value={task.title ?? ""}
                onChange={(event) =>
                  onChange({ ...task, title: event.target.value })
                }
                className="h-8 rounded-[var(--radius-control)] border-border/70 bg-background text-base shadow-none sm:text-xs"
                placeholder="What needs to be done?"
              />
            </div>

            {canChooseProjectSection && (
              <div className="space-y-1">
                <label htmlFor={sectionId} className="label-eyebrow text-[0.65rem]">
                  Project section
                </label>
                <select
                  id={sectionId}
                  value={task.section_id ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...task,
                      section_id: event.target.value || null,
                    })
                  }
                  className="h-8 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
                >
                  <option value="">General</option>
                  {(projectSections || []).map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor={notesId} className="label-eyebrow text-[0.65rem]">Notes</label>
              <textarea
                id={notesId}
                rows={1}
                value={task.notes ?? ""}
                onChange={(event) =>
                  onChange({ ...task, notes: event.target.value })
                }
                className="min-h-8 w-full resize-y rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 py-1.5 text-base outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
                placeholder="Add details, links, thoughts, or next-step context..."
              />
            </div>
          </section>

          <NextActionFields
            item={task}
            onChange={onChange}
            onRefreshOptions={onRefreshOptions}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/70 bg-background/90 p-2.5">
          <div className="flex items-center gap-3">
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            )}
            <p className="hidden text-xs text-muted-foreground sm:block">
              Created{" "}
              {task.created_at
                ? new Date(task.created_at).toLocaleDateString()
                : "date unknown"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="actsix-btn-outline h-8" onClick={onClose}>
              Cancel
            </Button>

            <Button
              disabled={saving}
              size="sm"
              className="actsix-btn-primary h-8"
              onClick={onSave}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving..." : saveLabel}
            </Button>
          </div>
        </div>
      </Card>

      {onDelete && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Delete task?"
          description={`Delete "${task.title || "this task"}"? This can't be undone.`}
          onConfirm={() => {
            setDeleteConfirmOpen(false);
            onDelete();
          }}
        />
      )}
    </div>
  );
};

export default TaskEditorModal;
