import { FormEvent, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { PeopleSearchSelect, type PeopleSearchPerson } from "@/components/people/PeopleSearchSelect";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { assignPosition } from "@/features/venues/api/venuePositionsApi";

type Props = {
  open: boolean;
  positionId: string;
  roleName: string;
  people: PeopleSearchPerson[];
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export default function VenuePositionAssignModal({
  open,
  positionId,
  roleName,
  people,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [personId, setPersonId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPersonId("");
    setDisplayName("");
    setNotes("");
  }, [open]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!personId && !displayName.trim()) {
      toast.error("Pick someone, or type a name");
      return;
    }

    setSaving(true);
    const { error } = await assignPosition({
      workspaceId,
      positionId,
      userId,
      // A directory person wins; the typed name is only stored when nobody was picked.
      personId: personId || null,
      displayName: personId ? "" : displayName.trim(),
      notes: notes.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error("Could not fill the position", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Fill Position"
      title={`Who is on ${roleName}?`}
      description="Someone from the directory, or a name for a helper who is not in it."
      footer={
        <>
          <div />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="venue-assign-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <UserPlus className="h-4 w-4" />
              {saving ? "Saving…" : "Add to position"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-assign-form" className="space-y-5" onSubmit={save}>
        <Field label="From the directory">
          <PeopleSearchSelect
            people={people}
            selectedPersonId={personId}
            onSelect={(id) => {
              setPersonId(id);
              if (id) setDisplayName("");
            }}
            placeholder="Search people..."
            showAllOnFocus
          />
        </Field>

        {!personId && (
          <Field label="Or a name" htmlFor="venue-assign-name">
            <input
              id="venue-assign-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Andre (freelance tech)"
              className={cn(fieldControlClass)}
            />
          </Field>
        )}

        <Field label="Notes" htmlFor="venue-assign-notes">
          <input
            id="venue-assign-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Cannot be here before 07:30"
            className={cn(fieldControlClass)}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
