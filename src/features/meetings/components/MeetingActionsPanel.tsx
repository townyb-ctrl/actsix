import type { FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PeopleSearchSelect } from "@/components/people/PeopleSearchSelect";
import type { MeetingAction, MeetingPersonProfile } from "@/features/meetings/lib/meetingTypes";

export type MeetingActionsPanelProps = {
  actions: MeetingAction[];
  meetingActionPeople: MeetingPersonProfile[];
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
  actionTitle,
  onActionTitleChange,
  selectedActionPersonId,
  onSelectActionPerson,
  due,
  onDueChange,
  onSubmit,
  onRemoveAction,
}: MeetingActionsPanelProps) {
  return (
    <div>
      <div className="space-y-3 px-4 py-3">
        <form onSubmit={onSubmit} className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
          <Input
            value={actionTitle}
            onChange={(event) => onActionTitleChange(event.target.value)}
            placeholder="Action point..."
            className="h-8 rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
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
              onChange={(event) => onDueChange(event.target.value)}
              className="h-8 rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
            />

            <Button type="submit" className="actsix-btn-primary min-h-10 rounded-xl px-3">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>

        <div className="max-h-[calc(100vh-32rem)] min-h-[18rem] space-y-2 overflow-y-auto pr-1">
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
                  {action.due ? ` | Due ${action.due}` : ""}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
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
