import { FolderKanban, Save, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ProjectEditorModalProps = {
  project: any;
  saving?: boolean;
  onChange: (project: any) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

const ProjectEditorModal = ({
  project,
  saving = false,
  onChange,
  onClose,
  onSave,
  onDelete,
}: ProjectEditorModalProps) => {
  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 bg-brand-ink/45 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl shadow-card border-border/70 bg-card max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-border/70">
          <div>
            <p className="label-eyebrow">Edit Project</p>
            <h2 className="text-2xl font-extrabold tracking-tight mt-1">
              Project details
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Update the project name, area, status, and notes.
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
              <FolderKanban className="h-4 w-4 text-brand-teal" />
              <h3 className="font-extrabold tracking-tight">Project identity</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft md:col-span-2">
                <label className="label-eyebrow">Project name</label>
                <Input
                  value={project.name ?? ""}
                  onChange={(event) =>
                    onChange({ ...project, name: event.target.value })
                  }
                  className="mt-2 border-border/70 bg-background"
                  placeholder="Project name"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Renaming this project will also update linked tasks.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <label className="label-eyebrow">Area</label>
                <Input
                  value={project.area ?? "General"}
                  onChange={(event) =>
                    onChange({ ...project, area: event.target.value })
                  }
                  className="mt-2 border-border/70 bg-background"
                  placeholder="General, Worship, Admin..."
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <label className="label-eyebrow">Status</label>
                <select
                  value={project.status ?? "In Progress"}
                  onChange={(event) =>
                    onChange({ ...project, status: event.target.value })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option>In Progress</option>
                  <option>Planning</option>
                  <option>On Hold</option>
                  <option>Completed</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <label className="label-eyebrow">Notes</label>
              <textarea
                value={project.notes ?? ""}
                onChange={(event) =>
                  onChange({ ...project, notes: event.target.value })
                }
                className="mt-2 min-h-36 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Describe the project goal, key details, or next thinking..."
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold tracking-tight">Advanced</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Created:{" "}
                  {project.created_at
                    ? new Date(project.created_at).toLocaleDateString()
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
                  Delete project
                </Button>
              )}
            </div>
          </section>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 p-4 border-t border-border/70 bg-card/95">
          <p className="text-xs text-muted-foreground">
            Save changes to update this project.
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>
              Cancel
            </Button>

            <Button
              disabled={saving}
              variant="outline"
              className="rounded-xl actsix-btn-soft font-bold"
              onClick={onSave}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save project"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProjectEditorModal;
