import {
  Archive,
  CheckCircle2,
  Clock,
  FileText,
  Save,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ProjectSelect from "@/components/ProjectSelect";
import ContextSelect from "@/components/ContextSelect";

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
    <div className="fixed inset-0 z-50 bg-brand-ink/45 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl shadow-card border-border/70 bg-card h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-border/70">
          <div>
            <p className="label-eyebrow">{eyebrow}</p>
            <h2 className="text-2xl font-extrabold tracking-tight mt-1">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          </div>

          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Archive className="h-4 w-4 text-brand-teal" />
              <h3 className="font-extrabold tracking-tight">Destination</h3>
            </div>

            <div className="rounded-2xl border border-brand-teal/30 bg-brand-teal/5 p-4 shadow-soft">
              <label className="label-eyebrow">Where does this belong?</label>
              <select
                value="task"
                disabled
                className="mt-2 h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm opacity-80"
              >
                <option value="task">Next Action</option>
              </select>

              <p className="text-xs text-muted-foreground mt-2">
                This item is already a Next Action.
              </p>
            </div>
          </section>

          <section className="grid gap-3">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
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

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
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

          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-brand-teal" />
              <h3 className="font-extrabold tracking-tight">Next Action details</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <label className="label-eyebrow">Project</label>
                <ProjectSelect
                  value={task.project ?? ""}
                  onChange={(project) => onChange({ ...task, project })}
                  onCreated={onRefreshOptions}
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <label className="label-eyebrow">Context</label>
                <ContextSelect
                  value={task.context ?? "General"}
                  onChange={(context) => onChange({ ...task, context })}
                  onCreated={onRefreshOptions}
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <label className="label-eyebrow flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Duration
                </label>
                <Input
                  type="number"
                  min="1"
                  value={task.minutes ?? 15}
                  onChange={(event) =>
                    onChange({
                      ...task,
                      minutes: Number(event.target.value) || 15,
                    })
                  }
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <label className="label-eyebrow">Priority</label>
                <select
                  value={task.priority ?? "Medium"}
                  onChange={(event) =>
                    onChange({ ...task, priority: event.target.value })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <label className="label-eyebrow">Energy</label>
                <select
                  value={task.energy ?? "Medium"}
                  onChange={(event) =>
                    onChange({ ...task, energy: event.target.value })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <label className="label-eyebrow">Due date</label>
                <Input
                  type="date"
                  value={task.due ?? ""}
                  onChange={(event) =>
                    onChange({ ...task, due: event.target.value || null })
                  }
                  className="mt-2 border-border/70 bg-background"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Tags className="h-4 w-4 text-brand-teal" />
              <h3 className="font-extrabold tracking-tight">Organization</h3>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <label className="label-eyebrow">Tags</label>
              <Input
                value={Array.isArray(task.tags) ? task.tags.join(", ") : ""}
                onChange={(event) =>
                  onChange({
                    ...task,
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-2 border-border/70 bg-background"
                placeholder="Worship, Admin, Follow-up"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Separate tags with commas.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold tracking-tight">Advanced</h3>
                <p className="text-sm text-muted-foreground mt-1">
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

        <div className="shrink-0 flex items-center justify-between gap-3 p-4 border-t border-border/70 bg-card/95">
          <p className="text-xs text-muted-foreground">
            Save changes to update this Next Action.
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>
              Cancel
            </Button>

            <Button
              disabled={saving}
              variant="outline"
              className="rounded-xl border-brand-teal/50 bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/15 hover:text-brand-teal font-bold"
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
