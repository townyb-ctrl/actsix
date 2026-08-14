import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteRunSheetItem, upsertRunSheetItem } from "@/features/venues/api/venueRunSheetApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";

type Props = {
  open: boolean;
  item: VenueRunSheetItem | null;
  spaces: VenueSpace[];
  hireId: string;
  workspaceId: string;
  userId: string;
  /** Seeds the times on a new item so the form opens on the right day. */
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

const addHour = (iso: string) => new Date(new Date(iso).getTime() + 60 * 60 * 1000).toISOString();

export default function VenueRunSheetItemModal({
  open,
  item,
  spaces,
  hireId,
  workspaceId,
  userId,
  defaultStartIso,
  onOpenChange,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [setupNotes, setSetupNotes] = useState("");
  const [avNotes, setAvNotes] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const seed = defaultStartIso || new Date().toISOString();

    setTitle(item?.title || "");
    setSpaceId(item?.space_id || "");
    setStartsAt(toLocalInput(item?.starts_at || seed));
    setEndsAt(toLocalInput(item?.ends_at || addHour(seed)));
    setSetupNotes(item?.setup_notes || "");
    setAvNotes(item?.av_notes || "");
    setAccessNotes(item?.access_notes || "");
    setRiskNotes(item?.risk_notes || "");
  }, [open, item, defaultStartIso]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      toast.error("Say what is happening");
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
    const { error } = await upsertRunSheetItem({
      itemId: item?.id,
      workspaceId,
      hireId,
      userId,
      payload: {
        title: title.trim(),
        // "" from the select means the whole venue, which the column stores as null.
        space_id: spaceId || null,
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        setup_notes: setupNotes.trim(),
        av_notes: avNotes.trim(),
        access_notes: accessNotes.trim(),
        risk_notes: riskNotes.trim(),
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the item", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!item) return;

    setDeleting(true);
    const { error } = await deleteRunSheetItem(item.id);
    setDeleting(false);

    if (error) {
      toast.error("Could not remove the item", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={item ? "Edit Item" : "New Item"}
      title={item ? "Run sheet item" : "Add to the run sheet"}
      description="One slot: what is happening, what it needs, and who can get where."
      size="lg"
      footer={
        <>
          {item ? (
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
              form="venue-run-sheet-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save item"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-run-sheet-form" className="space-y-5" onSubmit={save}>
        <FieldGroup title="What and when">
          <Field label="What is happening" htmlFor="run-sheet-title">
            <input
              id="run-sheet-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Registration"
              className={cn(fieldControlClass)}
            />
          </Field>

          <Field label="Space" htmlFor="run-sheet-space">
            <select
              id="run-sheet-space"
              value={spaceId}
              onChange={(event) => setSpaceId(event.target.value)}
              className={cn(fieldControlClass)}
            >
              <option value="">Whole venue</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </Field>

          <FieldRow>
            <Field label="Starts" htmlFor="run-sheet-start">
              <input
                id="run-sheet-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Ends" htmlFor="run-sheet-end">
              <input
                id="run-sheet-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>
          </FieldRow>
        </FieldGroup>

        <FieldGroup title="What it needs">
          <Field label="Setup" htmlFor="run-sheet-setup">
            <textarea
              id="run-sheet-setup"
              value={setupNotes}
              onChange={(event) => setSetupNotes(event.target.value)}
              rows={2}
              placeholder="40 chairs theatre style, 4 trestle tables at the door"
              className={cn(fieldControlClass, "min-h-16 py-2")}
            />
          </Field>

          <Field label="AV" htmlFor="run-sheet-av">
            <textarea
              id="run-sheet-av"
              value={avNotes}
              onChange={(event) => setAvNotes(event.target.value)}
              rows={2}
              placeholder="Handheld mic 1 hot, camera feed to foyer TV"
              className={cn(fieldControlClass, "min-h-16 py-2")}
            />
          </Field>

          <Field label="Access" htmlFor="run-sheet-access">
            <textarea
              id="run-sheet-access"
              value={accessNotes}
              onChange={(event) => setAccessNotes(event.target.value)}
              rows={2}
              placeholder="Main doors open, upstairs closed off with Q-track"
              className={cn(fieldControlClass, "min-h-16 py-2")}
            />
          </Field>

          <Field label="Risks and notes" htmlFor="run-sheet-risk">
            <textarea
              id="run-sheet-risk"
              value={riskNotes}
              onChange={(event) => setRiskNotes(event.target.value)}
              rows={2}
              placeholder="Worship practice moved this week"
              className={cn(fieldControlClass, "min-h-16 py-2")}
            />
          </Field>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
