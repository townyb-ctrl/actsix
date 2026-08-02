import { Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, FieldGroup, FieldRow, CheckboxField, fieldControlClass } from "@/components/ui/field";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { cn } from "@/lib/utils";

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

  const nameId = "project-editor-name";
  const areaId = "project-editor-area";
  const statusId = "project-editor-status";
  const dueDateId = "project-editor-due-date";
  const eventStartId = "project-editor-event-start";
  const eventEndId = "project-editor-event-end";
  const notesId = "project-editor-notes";

  return (
    <FormDialog
      open={Boolean(project)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      eyebrow="Edit Project"
      title="Project details"
      description="Update the project name, area, status, and notes."
      size="lg"
      footer={
        <>
          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground">
              Created:{" "}
              {project.created_at ? new Date(project.created_at).toLocaleDateString() : "Unknown"}
            </p>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete project
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" className="rounded-lg" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              className="actsix-btn-primary rounded-lg font-bold"
              onClick={onSave}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save project"}
            </Button>
          </div>
        </>
      }
    >
      <FieldGroup title="Project identity">
        <Field label="Project name" htmlFor={nameId} hint="Renaming this project will also update linked tasks.">
          <Input
            id={nameId}
            value={project.name ?? ""}
            onChange={(event) => onChange({ ...project, name: event.target.value })}
            className={cn(fieldControlClass)}
            placeholder="Project name"
          />
        </Field>

        <FieldRow>
          <Field label="Area" htmlFor={areaId}>
            <Input
              id={areaId}
              value={project.area ?? "General"}
              onChange={(event) => onChange({ ...project, area: event.target.value })}
              className={cn(fieldControlClass)}
              placeholder="General, Worship, Admin..."
            />
          </Field>

          <Field label="Status" htmlFor={statusId}>
            <select
              id={statusId}
              value={project.status ?? "In Progress"}
              onChange={(event) => onChange({ ...project, status: event.target.value })}
              className={cn(fieldControlClass)}
            >
              <option>In Progress</option>
              <option>Planning</option>
              <option>On Hold</option>
              <option>Completed</option>
            </select>
          </Field>
        </FieldRow>
      </FieldGroup>

      <FieldGroup title="Schedule">
        <Field label="Complete by" htmlFor={dueDateId} className="max-w-xs">
          <Input
            id={dueDateId}
            type="date"
            value={project.due_date ?? ""}
            onChange={(event) => onChange({ ...project, due_date: event.target.value || null })}
            className={cn(fieldControlClass)}
          />
        </Field>

        <div className="space-y-3">
          <CheckboxField
            id="project-editor-calendar-reminder"
            label="Add reminder to calendar"
            checked={Boolean(project.add_to_calendar || project.calendar_event_id)}
            onCheckedChange={(checked) => onChange({ ...project, add_to_calendar: checked })}
          />

          <CheckboxField
            id="project-editor-is-event"
            label="This project is an event"
            checked={Boolean(project.is_event)}
            onCheckedChange={(checked) => onChange({ ...project, is_event: checked })}
          />
        </div>

        {project.is_event && (
          <FieldRow>
            <Field label="Event starts" htmlFor={eventStartId}>
              <Input
                id={eventStartId}
                type="datetime-local"
                value={project.event_start_at ?? ""}
                onChange={(event) => onChange({ ...project, event_start_at: event.target.value || null })}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Event ends" htmlFor={eventEndId}>
              <Input
                id={eventEndId}
                type="datetime-local"
                value={project.event_end_at ?? ""}
                onChange={(event) => onChange({ ...project, event_end_at: event.target.value || null })}
                className={cn(fieldControlClass)}
              />
            </Field>
          </FieldRow>
        )}
      </FieldGroup>

      <FieldGroup title="Notes & people">
        <Field label="Notes" htmlFor={notesId}>
          <textarea
            id={notesId}
            value={project.notes ?? ""}
            onChange={(event) => onChange({ ...project, notes: event.target.value })}
            className={cn(fieldControlClass, "min-h-36 py-2")}
            placeholder="Describe the project goal, key details, or next thinking..."
          />
        </Field>

        {showCollaborators && (
          <Field label="Collaborators">
            <PeopleMultiSearchSelect
              people={people}
              selectedPersonIds={selectedCollaboratorIds}
              onChange={onCollaboratorChange || (() => undefined)}
              placeholder="Search People to add as collaborators..."
              emptyText="No matching People profiles found."
              disabled={!onCollaboratorChange}
              showAllOnFocus
            />
          </Field>
        )}
      </FieldGroup>
    </FormDialog>
  );
};

export default ProjectEditorModal;
