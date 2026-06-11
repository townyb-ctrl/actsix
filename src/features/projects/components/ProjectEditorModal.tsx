import { FolderKanban, Save, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";

type PersonOption = {
  id: string;
  display_name: string;
  email?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
};

type ProjectEditorModalProps = {
  project: any;
  saving?: boolean;
  people?: PersonOption[];
  selectedCollaboratorIds?: string[];
  onCollaboratorChange?: (personIds: string[]) => void;
  showCollaborators?: boolean;
  onChange: (project: any) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

const ProjectEditorModal = ({
  project,
  saving = false,
  people = [],
  selectedCollaboratorIds = [],
  onCollaboratorChange,
  showCollaborators = false,
  onChange,
  onClose,
  onSave,
  onDelete,
}: ProjectEditorModalProps) => {
  if (!project) return null;

  const titleId = "project-editor-title";
  const descriptionId = "project-editor-description";
  const nameId = "project-editor-name";
  const areaId = "project-editor-area";
  const statusId = "project-editor-status";
  const notesId = "project-editor-notes";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/35 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <Card className="actsix-panel flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-b-none sm:max-h-[88vh] sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="label-eyebrow">Edit Project</p>
            <h2 id={titleId} className="mt-1 text-xl font-extrabold leading-tight">
              Project details
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              Update the project name, area, status, and notes.
            </p>
          </div>

          <Button variant="ghost" size="icon" className="rounded-lg text-muted-foreground" onClick={onClose} aria-label="Close project editor">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-brand-teal" />
              <h3 className="font-extrabold">Project identity</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-background/45 p-3 md:col-span-2">
                <label htmlFor={nameId} className="label-eyebrow">Project name</label>
                <Input
                  id={nameId}
                  value={project.name ?? ""}
                  onChange={(event) =>
                    onChange({ ...project, name: event.target.value })
                  }
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                  placeholder="Project name"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Renaming this project will also update linked tasks.
                </p>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                <label htmlFor={areaId} className="label-eyebrow">Area</label>
                <Input
                  id={areaId}
                  value={project.area ?? "General"}
                  onChange={(event) =>
                    onChange({ ...project, area: event.target.value })
                  }
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                  placeholder="General, Worship, Admin..."
                />
              </div>

              <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                <label htmlFor={statusId} className="label-eyebrow">Status</label>
                <select
                  id={statusId}
                  value={project.status ?? "In Progress"}
                  onChange={(event) =>
                    onChange({ ...project, status: event.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
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
            <div className="rounded-lg border border-border/70 bg-background/45 p-3">
              <label htmlFor={notesId} className="label-eyebrow">Notes</label>
              <textarea
                id={notesId}
                value={project.notes ?? ""}
                onChange={(event) =>
                  onChange({ ...project, notes: event.target.value })
                }
                className="mt-2 min-h-36 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                placeholder="Describe the project goal, key details, or next thinking..."
              />
            </div>
          </section>

          {showCollaborators && (
            <section>
              <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                <label className="label-eyebrow">Collaborators</label>
                <div className="mt-2">
                  <PeopleMultiSearchSelect
                    people={people}
                    selectedPersonIds={selectedCollaboratorIds}
                    onChange={onCollaboratorChange || (() => undefined)}
                    placeholder="Search People to add as collaborators..."
                    emptyText="No matching People profiles found."
                    disabled={!onCollaboratorChange}
                    showAllOnFocus
                  />
                </div>
              </div>
            </section>
          )}

          <section className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold">Advanced</h3>
                <p className="mt-1 text-sm text-muted-foreground">
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

        <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Save changes to update this project.
          </p>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button variant="outline" className="rounded-lg" onClick={onClose}>
              Cancel
            </Button>

            <Button
              disabled={saving}
              variant="outline"
              className="actsix-btn-soft rounded-lg font-bold"
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
