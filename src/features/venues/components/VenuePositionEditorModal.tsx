import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deletePosition, upsertPosition } from "@/features/venues/api/venuePositionsApi";
import type { VenuePosition, VenuePositionRole } from "@/features/venues/lib/venuePositions";

type Props = {
  open: boolean;
  position: VenuePosition | null;
  roles: VenuePositionRole[];
  hireId: string;
  workspaceId: string;
  userId: string;
  /** Seeds the times on a new position so it lands on the right day. */
  defaultStartIso?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

/** <input type="datetime-local"> wants local time with no zone; the DB stores UTC. */
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInput = (value: string) => new Date(value).toISOString();

const addHours = (iso: string, hours: number) =>
  new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();

export default function VenuePositionEditorModal({
  open,
  position,
  roles,
  hireId,
  workspaceId,
  userId,
  defaultStartIso,
  onOpenChange,
  onSaved,
}: Props) {
  const activeRoles = roles.filter((role) => role.is_active || role.id === position?.role_id);

  const [roleId, setRoleId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [needed, setNeeded] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const seed = defaultStartIso || new Date().toISOString();

    setRoleId(position?.role_id || activeRoles[0]?.id || "");
    setStartsAt(toLocalInput(position?.starts_at || seed));
    setEndsAt(toLocalInput(position?.ends_at || addHours(seed, 4)));
    setNeeded(String(position?.needed ?? 1));
    setNotes(position?.notes || "");
  }, [open, position, defaultStartIso]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!roleId) {
      toast.error("Choose a role");
      return;
    }
    if (!startsAt || !endsAt) {
      toast.error("Set both a start and end time");
      return;
    }
    if (new Date(fromLocalInput(endsAt)) <= new Date(fromLocalInput(startsAt))) {
      toast.error("The end time must be after the start time");
      return;
    }

    setSaving(true);
    const { error } = await upsertPosition({
      positionId: position?.id,
      workspaceId,
      hireId,
      userId,
      payload: {
        role_id: roleId,
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        needed: Math.max(1, Number(needed) || 1),
        notes: notes.trim(),
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the position", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!position) return;

    setDeleting(true);
    const { error } = await deletePosition(position.id);
    setDeleting(false);

    if (error) {
      toast.error("Could not remove the position", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={position ? "Edit Position" : "New Position"}
      title={position ? "Position" : "Add a position"}
      description="A role needed for a stretch of the event, and how many people it takes."
      footer={
        <>
          {position ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={remove}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Removing…" : "Remove"}
            </Button>
          ) : (
            <div className="mr-auto" />
          )}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="venue-position-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save position"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-position-form" className="space-y-5" onSubmit={save}>
        <FieldRow>
          <Field label="Role" htmlFor="venue-position-role">
            <select
              id="venue-position-role"
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              className={cn(fieldControlClass)}
            >
              <option value="" disabled>
                Choose a role
              </option>
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="People needed" htmlFor="venue-position-needed">
            <input
              id="venue-position-needed"
              type="number"
              min="1"
              value={needed}
              onChange={(event) => setNeeded(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Starts" htmlFor="venue-position-start">
            <input
              id="venue-position-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>

          <Field label="Ends" htmlFor="venue-position-end">
            <input
              id="venue-position-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>
        </FieldRow>

        <Field label="Notes" htmlFor="venue-position-notes">
          <textarea
            id="venue-position-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Walkie channel 2, meet at the foyer desk"
            className={cn(fieldControlClass, "min-h-16 py-2")}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
