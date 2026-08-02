import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldControlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { PeopleSearchSelect, type PeopleSearchPerson } from "@/components/people/PeopleSearchSelect";

export type NewTaskDraft = {
  title: string;
  due: string;
  assigned_person_id: string;
};

type ProjectAddTaskRowProps = {
  /** Section name, used in the placeholder so the target is never ambiguous. */
  targetName: string;
  people: PeopleSearchPerson[];
  onAdd: (draft: NewTaskDraft) => Promise<void>;
};

/**
 * Collapsed to a single quiet row until it's needed. The assignee and date
 * fields used to sit permanently under every section, so four open sections
 * meant four compose forms competing with the tasks themselves.
 */
const ProjectAddTaskRow = ({ targetName, people, onAdd }: ProjectAddTaskRowProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<NewTaskDraft>({
    title: "",
    due: "",
    assigned_person_id: "",
  });
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) titleRef.current?.focus();
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setDraft({ title: "", due: "", assigned_person_id: "" });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!draft.title.trim() || saving) return;

    setSaving(true);
    await onAdd({ ...draft, title: draft.title.trim() });
    setSaving(false);

    // Assignee and date stay put so a run of related tasks is a title away.
    setDraft((current) => ({ ...current, title: "" }));
    titleRef.current?.focus();
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-9 w-full justify-start px-2 text-[13px] font-bold text-muted-foreground hover:text-brand-teal"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
      className="rounded-xl border border-border/70 bg-card p-2.5"
    >
      <div className="flex items-start gap-2">
        <Input
          ref={titleRef}
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder={`Add task to ${targetName}...`}
          className={cn(fieldControlClass, "flex-1")}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 text-muted-foreground"
          onClick={close}
          aria-label="Close add task form"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <PeopleSearchSelect
          people={people}
          selectedPersonId={draft.assigned_person_id}
          onSelect={(personId) => setDraft({ ...draft, assigned_person_id: personId })}
          placeholder="Assign..."
          emptyText="No project collaborators found."
          showAllOnFocus
        />

        <Input
          type="date"
          value={draft.due}
          onChange={(event) => setDraft({ ...draft, due: event.target.value })}
          className={cn(fieldControlClass)}
        />

        <Button
          type="submit"
          className="actsix-btn-primary h-11 min-h-11 rounded-lg px-4"
          disabled={!draft.title.trim() || saving}
        >
          {saving ? "Adding..." : "Add"}
        </Button>
      </div>
    </form>
  );
};

export default ProjectAddTaskRow;
