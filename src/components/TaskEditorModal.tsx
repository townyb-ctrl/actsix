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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/45 p-4 backdrop-blur-sm">
      <Card className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden border-border/70 bg-card shadow-card">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 p-5">
          <div>
            <p className="label-eyebrow">{eyebrow}</p>
            <h2 className="mt-1 text-xl font-extrabold leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          </div>

          <Button variant="ghost" size="icon" className="rounded-lg text-muted-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Archive className="h-4 w-4 text-brand-teal" />
              <h3 className="font-extrabold">Destination</h3>
            </div>

            <div className="rounded-lg border border-brand-teal/25 bg-brand-teal/5 p-3">
              <label className="label-eyebrow">Where does this belong?</label>
              <select
                value="task"
                disabled
                className="mt-2 h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm opacity-80"
              >
                <option value="task">Next Action</option>
              </select>

              <p className="mt-2 text-xs text-muted-foreground">
                This item is already a Next Action.
              </p>
            </div>
          </section>

          <section className="grid gap-3">
            <div className="rounded-lg border border-border/70 bg-background/45 p-3">
              <label className="label-eyebrow">Title</label>
              <Input
                value={task.title ?? ""}
                onChange={(event) =>
                  onChange({ ...task, title: event.target.value })
                }
                className="mt-2 border-border/70 bg-background"
                placeholder="What needs to be done?"
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-background/45 p-3">
              <label className="label-eyebrow flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Notes
              </label>
              <textarea
                value={task.notes ?? ""}
                onChange={(event) =>
                  onChange({ ...task, notes: event.target.value })
                }
                className="mt-2 min-h-28 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Add details, links, thoughts, or next-step context..."
              />
            </div>
          </section>

          <NextActionFields
            item={task}
            onChange={onChange}
            onRefreshOptions={onRefreshOptions}
          />

          <section className="rounded-lg border border-border/70 bg-muted/30 p-3">
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

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-card/95 p-4">
          <p className="text-xs text-muted-foreground">
            Save changes to update this Next Action.
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-lg" onClick={onClose}>
              Cancel
            </Button>

            <Button
              disabled={saving}
              variant="outline"
              className="rounded-lg border-brand-teal/50 bg-brand-teal/10 font-bold text-brand-teal hover:bg-brand-teal/15 hover:text-brand-teal"
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
