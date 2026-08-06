import { useRef } from "react";
import { Camera, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { cn } from "@/lib/utils";

export type ServiceContactDraft = {
  id?: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  photo_url: string | null;
};

export type ServiceContactEditorModalProps = {
  contact: ServiceContactDraft | null;
  saving: boolean;
  uploadingPhoto: boolean;
  categorySuggestions: string[];
  onChange: (contact: ServiceContactDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onPhotoSelected: (file: File) => void;
};

const ServiceContactEditorModal = ({
  contact,
  saving,
  uploadingPhoto,
  categorySuggestions,
  onChange,
  onClose,
  onSave,
  onPhotoSelected,
}: ServiceContactEditorModalProps) => {
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  if (!contact) return null;

  const isEditing = Boolean(contact.id);

  return (
    <FormDialog
      open={Boolean(contact)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      eyebrow="Service Contacts"
      title={isEditing ? "Edit Contact" : "Add Contact"}
      description="Save the people your workspace calls on - electricians, plumbers, police, ambulance, social workers, and more."
      size="lg"
      footer={
        <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:items-center">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="actsix-btn-primary"
            onClick={onSave}
            disabled={saving || !contact.name.trim()}
          >
            {isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? "Saving..." : isEditing ? "Save Contact" : "Add Contact"}
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3">
        <PersonAvatar name={contact.name} avatarUrl={contact.photo_url} size="xl" shape="rounded" />

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={uploadingPhoto}
            onClick={() => photoInputRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" />
            {uploadingPhoto ? "Uploading..." : contact.photo_url ? "Change photo" : "Add photo"}
          </Button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPhotoSelected(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <FieldRow>
        <Field label="Name" htmlFor="contact-editor-name">
          <Input
            id="contact-editor-name"
            value={contact.name}
            onChange={(event) => onChange({ ...contact, name: event.target.value })}
            placeholder="John's Plumbing"
            className={cn(fieldControlClass)}
            autoFocus
          />
        </Field>

        <Field label="Category" htmlFor="contact-editor-category" hint="Electrician, Plumber, Police, Ambulance, Social Worker...">
          <Input
            id="contact-editor-category"
            list="service-contact-category-suggestions"
            value={contact.category}
            onChange={(event) => onChange({ ...contact, category: event.target.value })}
            placeholder="Plumber"
            className={cn(fieldControlClass)}
          />
          <datalist id="service-contact-category-suggestions">
            {categorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Phone" htmlFor="contact-editor-phone">
          <Input
            id="contact-editor-phone"
            type="tel"
            value={contact.phone}
            onChange={(event) => onChange({ ...contact, phone: event.target.value })}
            placeholder="(555) 123-4567"
            className={cn(fieldControlClass)}
          />
        </Field>

        <Field label="Email" htmlFor="contact-editor-email">
          <Input
            id="contact-editor-email"
            type="email"
            value={contact.email}
            onChange={(event) => onChange({ ...contact, email: event.target.value })}
            placeholder="Optional"
            className={cn(fieldControlClass)}
          />
        </Field>
      </FieldRow>

      <Field label="Address / Service Area" htmlFor="contact-editor-address">
        <Input
          id="contact-editor-address"
          value={contact.address}
          onChange={(event) => onChange({ ...contact, address: event.target.value })}
          placeholder="Optional"
          className={cn(fieldControlClass)}
        />
      </Field>

      <Field label="Notes" htmlFor="contact-editor-notes">
        <Textarea
          id="contact-editor-notes"
          value={contact.notes}
          onChange={(event) => onChange({ ...contact, notes: event.target.value })}
          placeholder="Optional"
          rows={3}
          className="min-h-20 rounded-[var(--radius-control)] border-border/70 bg-background text-sm"
        />
      </Field>
    </FormDialog>
  );
};

export default ServiceContactEditorModal;
