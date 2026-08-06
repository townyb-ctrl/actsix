import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="actsix-panel max-w-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle>Edit Meeting</DialogTitle>
          <DialogDescription>
            Change the core meeting information without crowding the main page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label-eyebrow">Meeting title</label>
            <Input
              value={draft.title || ""}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              className="mt-2 h-8 rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
            />
          </div>

          <div>
            <label className="label-eyebrow">Date</label>
            <Input
              type="date"
              value={draft.meeting_date || ""}
              onChange={(event) => onChange({ ...draft, meeting_date: event.target.value || null })}
              className="mt-2 h-8 rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
            />
          </div>

          <div>
            <label className="label-eyebrow">Time</label>
            <Input
              type="time"
              value={draft.meeting_time || ""}
              onChange={(event) => onChange({ ...draft, meeting_time: event.target.value || null })}
              className="mt-2 h-8 rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
            />
          </div>

          <div>
            <label className="label-eyebrow">Location</label>
            <Input
              value={draft.location || ""}
              onChange={(event) => onChange({ ...draft, location: event.target.value })}
              className="mt-2 h-8 rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="actsix-btn-primary min-h-10 rounded-xl" onClick={onSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
