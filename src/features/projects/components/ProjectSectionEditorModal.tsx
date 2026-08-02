import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { PeoplePickerPerson } from "@/components/people/peoplePickerUtils";

export type ProjectSection = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  description: string;
  leader_person_id: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjectSectionEditorModalProps = {
  section: Partial<ProjectSection> | null;
  saving: boolean;
  assignablePeople: PeoplePickerPerson[];
  onChange: (section: Partial<ProjectSection>) => void;
  onClose: () => void;
  onSave: () => void;
};

const ProjectSectionEditorModal = ({
  section,
  saving,
  assignablePeople,
  onChange,
  onClose,
  onSave,
}: ProjectSectionEditorModalProps) => {
  if (!section) return null;

  const isEditing = Boolean(section.id);

  return (
    <FormDialog
      open={Boolean(section)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      eyebrow="Project Sections"
      title={isEditing ? "Edit Section" : "Add Section"}
      description="Sections group related tasks and can have one leader from the project collaborators."
      size="md"
      footer={
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="actsix-btn-primary rounded-xl"
            onClick={onSave}
            disabled={saving}
          >
            {isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? "Saving..." : isEditing ? "Save Section" : "Add Section"}
          </Button>
        </div>
      }
    >
      <Field label="Section name" htmlFor="section-editor-name">
        <Input
          id="section-editor-name"
          value={section.name || ""}
          onChange={(event) => onChange({ ...section, name: event.target.value })}
          placeholder="Worship, Media, Logistics..."
          className={cn(fieldControlClass)}
        />
      </Field>

      <FieldRow>
        <Field
          label="Leader"
          htmlFor="section-editor-leader"
          hint="Add someone as a collaborator before making them a section leader."
        >
          <select
            id="section-editor-leader"
            value={section.leader_person_id || ""}
            onChange={(event) => onChange({ ...section, leader_person_id: event.target.value || null })}
            className={cn(fieldControlClass)}
          >
            <option value="">No leader</option>
            {assignablePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor="section-editor-status">
          <select
            id="section-editor-status"
            value={section.status || "Active"}
            onChange={(event) => onChange({ ...section, status: event.target.value })}
            className={cn(fieldControlClass)}
          >
            <option>Not started</option>
            <option>Active</option>
            <option>Blocked</option>
            <option>Complete</option>
          </select>
        </Field>
      </FieldRow>

      <Field
        label="Description"
        htmlFor="section-editor-description"
        hint="Shows next to the leader's name, so keep it short."
      >
        <Input
          id="section-editor-description"
          value={section.description || ""}
          onChange={(event) => onChange({ ...section, description: event.target.value })}
          placeholder="What this workstream covers..."
          className={cn(fieldControlClass)}
        />
      </Field>
    </FormDialog>
  );
};

export default ProjectSectionEditorModal;
