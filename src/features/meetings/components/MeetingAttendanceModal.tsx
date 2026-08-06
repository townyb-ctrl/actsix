import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MeetingPerson } from "@/features/meetings/components/MeetingPeopleSection";

const STATUS_OPTIONS = [
  { value: "invited", label: "Invited" },
  { value: "attended", label: "Attended" },
  { value: "apology", label: "Apology" },
  { value: "absent", label: "Absent" },
  { value: "not_required", label: "Not required" },
];

export type MeetingAttendanceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingPeople: MeetingPerson[];
  onUpdateStatus: (personId: string, status: string) => void;
};

export function MeetingAttendanceModal({
  open,
  onOpenChange,
  meetingPeople,
  onUpdateStatus,
}: MeetingAttendanceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="actsix-panel flex max-h-[85vh] max-w-5xl flex-col overflow-hidden rounded-xl">
        <DialogHeader>
          <DialogTitle>Attendance / Apologies</DialogTitle>
          <DialogDescription>
            Mark attendance from the People already connected to this meeting.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
          {meetingPeople.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No people have been added to this meeting yet. Add individuals, groups, or folders in the Meeting People section first.
            </div>
          )}

          {meetingPeople.map((meetingPerson) => {
            const person = Array.isArray(meetingPerson.people)
              ? meetingPerson.people[0]
              : meetingPerson.people;

            return (
              <div
                key={meetingPerson.id}
                className="rounded-xl border border-border/70 bg-background p-3"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold tracking-tight">
                      {person?.display_name || "Unknown person"}
                    </p>
                    {person?.email && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {person.email}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    {STATUS_OPTIONS.map((option) => {
                      const active = meetingPerson.status === option.value;

                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          className={active ? "actsix-btn-primary min-h-10 rounded-xl px-3" : "rounded-xl px-3"}
                          onClick={() => onUpdateStatus(meetingPerson.person_id, option.value)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
