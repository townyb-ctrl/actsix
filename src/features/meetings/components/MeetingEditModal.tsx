import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, fieldControlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/features/meetings/lib/meetingTypes";

export type MeetingEditDraft = Pick<Meeting, "title" | "meeting_date" | "meeting_time" | "location">;

export type MeetingEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: MeetingEditDraft;
  onChange: (draft: MeetingEditDraft) => void;
  onSave: () => void;
};

export function MeetingEditModal({ open, onOpenChange, draft, onChange, onSave }: MeetingEditModalProps) {
  const [touched, setTouched] = useState(false);

  const titleMissing = touched && !draft.title.trim();

  const handleSave = () => {
    if (!draft.title.trim()) {
      setTouched(true);
      return;
    }
    onSave();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTouched(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="actsix-panel max-w-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle>Edit Meeting</DialogTitle>
          <DialogDescription>
            Change the core meeting information without crowding the main page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Meeting title"
            htmlFor="meeting-edit-title"
            hint={titleMissing ? "Title is required." : undefined}
            className={cn(titleMissing && "[&_p]:text-brand-danger")}
          >
            <Input
              id="meeting-edit-title"
              value={draft.title || ""}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              aria-invalid={titleMissing || undefined}
              className={cn(fieldControlClass, titleMissing && "border-brand-danger focus-visible:border-brand-danger focus-visible:ring-brand-danger/15")}
            />
          </Field>

          <Field label="Date" htmlFor="meeting-edit-date">
            <Input
              id="meeting-edit-date"
              type="date"
              value={draft.meeting_date || ""}
              onChange={(event) => onChange({ ...draft, meeting_date: event.target.value || null })}
              className={fieldControlClass}
            />
          </Field>

          <Field label="Time" htmlFor="meeting-edit-time">
            <Input
              id="meeting-edit-time"
              type="time"
              value={draft.meeting_time || ""}
              onChange={(event) => onChange({ ...draft, meeting_time: event.target.value || null })}
              className={fieldControlClass}
            />
          </Field>

          <Field label="Location" htmlFor="meeting-edit-location">
            <Input
              id="meeting-edit-location"
              value={draft.location || ""}
              onChange={(event) => onChange({ ...draft, location: event.target.value })}
              className={fieldControlClass}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="actsix-btn-primary min-h-10 rounded-xl" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
