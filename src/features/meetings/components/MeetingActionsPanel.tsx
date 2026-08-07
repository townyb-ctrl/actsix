import type { FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PeopleSearchSelect } from "@/components/people/PeopleSearchSelect";
import { fieldControlClass } from "@/components/ui/field";
import { formatDate } from "@/features/meetings/lib/meetingAgenda";
import type { MeetingAction, MeetingPersonProfile } from "@/features/meetings/lib/meetingTypes";

export type MeetingActionsPanelProps = {
  actions: MeetingAction[];
  meetingActionPeople: MeetingPersonProfile[];
  /** The add-action form's open state lives in the parent so the "Action
   * Points" section header can drive it too, not just this panel's own button. */
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  actionTitle: string;
  onActionTitleChange: (value: string) => void;
  selectedActionPersonId: string;
  onSelectActionPerson: (personId: string) => void;
  due: string;
  onDueChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onRemoveAction: (id: string) => void;
};

export function MeetingActionsPanel({
  actions,
  meetingActionPeople,
  formOpen,
  onFormOpenChange,
  actionTitle,
  onActionTitleChange,
  selectedActionPersonId,
  onSelectActionPerson,
  due,
  onDueChange,
  onSubmit,
  onRemoveAction,
}: MeetingActionsPanelProps) {
  const handleSubmit = (event: FormEvent) => {
    onSubmit(event);
    onFormOpenChange(false);
  };

  return (
    <div>
      <div className="space-y-3 px-4 py-3">
        {formOpen && (
          <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label-eyebrow">New Action Point</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cancel"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => onFormOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Input
              value={actionTitle}
              onChange={(event) => onActionTitleChange(event.target.value)}
              placeholder="Action point..."
              aria-label="Action point"
              autoFocus
              className={fieldControlClass}
            />

            <PeopleSearchSelect
              people={meetingActionPeople}
              selectedPersonId={selectedActionPersonId}
              onSelect={onSelectActionPerson}
              placeholder="Search meeting people..."
              emptyText="No matching meeting people found."
              zIndexClass="z-20"
              dropdownZIndexClass="z-30"
            />

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                type="date"
                value={due}
                aria-label="Due date"
                onChange={(event) => onDueChange(event.target.value)}
                className={fieldControlClass}
              />

              <Button
                type="submit"
                aria-label="Add action point"
                className="actsix-btn-primary min-h-10 rounded-xl px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}

        <div className="max-h-[20rem] min-h-[6rem] space-y-2 overflow-y-auto pr-1">
          {actions.length === 0 && (
            <div className="actsix-empty-state min-h-[8rem] text-left text-sm">
              No action points yet.
            </div>
          )}

          {actions.map((action) => (
            <div
              key={action.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/65 p-3 transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
            >
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-tight">{action.title}</div>
                <div className="mt-1 text-xs font-medium text-muted-foreground">
                  {action.assignee || "Unassigned"}
                  {action.due ? ` | Due ${formatDate(action.due)}` : ""}
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove action point: ${action.title}`}
                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveAction(action.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
