import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  deleteTurnaroundTask,
  upsertTurnaroundTask,
} from "@/features/venues/api/venueTurnaroundApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";
import {
  VENUE_TURNAROUND_KINDS,
  type VenueTurnaroundKind,
  type VenueTurnaroundTask,
} from "@/features/venues/lib/venueTurnaround";

type Props = {
  open: boolean;
  task: VenueTurnaroundTask | null;
  spaces: VenueSpace[];
  hireId: string;
  workspaceId: string;
  userId: string;
  /** Seeds the window on a new task, usually the end of the last booking. */
  defaultStartIso?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInput = (value: string) => new Date(value).toISOString();

const addHour = (iso: string) => new Date(new Date(iso).getTime() + 60 * 60 * 1000).toISOString();

export default function VenueTurnaroundTaskModal({
  open,
  task,
  spaces,
  hireId,
  workspaceId,
  userId,
  defaultStartIso,
  onOpenChange,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<VenueTurnaroundKind>("Cleaning");
  const [spaceId, setSpaceId] = useState("");
  const [scheduled, setScheduled] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const seed = defaultStartIso || new Date().toISOString();

    setTitle(task?.title || "");
    setKind(task?.kind || "Cleaning");
    setSpaceId(task?.space_id || "");
    setScheduled(task ? Boolean(task.starts_at) : true);
    setStartsAt(toLocalInput(task?.starts_at || seed));
    setEndsAt(toLocalInput(task?.ends_at || addHour(task?.starts_at || seed)));
    setNotes(task?.notes || "");
  }, [open, task, defaultStartIso]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      toast.error("Say what needs doing");
      return;
    }

    if (scheduled) {
      if (!startsAt || !endsAt) {
        toast.error("Set both a start and end time, or untick the time window");
        return;
      }
      if (new Date(fromLocalInput(endsAt)) <= new Date(fromLocalInput(startsAt))) {
        toast.error("The end time must be after the start time");
        return;
      }
    }

    setSaving(true);
    const { error } = await upsertTurnaroundTask({
      taskId: task?.id,
      workspaceId,
      hireId,
      userId,
      payload: {
        title: title.trim(),
        kind,
        // "" from the select means the whole venue, which the column stores as null.
        space_id: spaceId || null,
        // Both ends or neither - a half-open window cannot be checked against a
        // booking, so the database refuses it too.
        starts_at: scheduled ? fromLocalInput(startsAt) : null,
        ends_at: scheduled ? fromLocalInput(endsAt) : null,
        notes: notes.trim(),
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the task", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!task) return;

    setDeleting(true);
    const { error } = await deleteTurnaroundTask(task.id);
    setDeleting(false);

    if (error) {
      toast.error("Could not remove the task", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={task ? "Edit Task" : "Add Task"}
      title={task ? "Turnaround task" : "Add a turnaround task"}
      description="Work between this hire ending and the building being ready again."
      footer={
        <>
          {task ? (
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
              form="venue-turnaround-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save task"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-turnaround-form" className="space-y-5" onSubmit={save}>
        <FieldGroup title="The work">
          <Field label="What needs doing" htmlFor="venue-turnaround-title">
            <Input
              id="venue-turnaround-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Mop the hall floor"
              className={cn(fieldControlClass)}
            />
          </Field>

          <FieldRow>
            <Field label="Kind" htmlFor="venue-turnaround-kind">
              <select
                id="venue-turnaround-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as VenueTurnaroundKind)}
                className={cn(fieldControlClass)}
              >
                {VENUE_TURNAROUND_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Where" htmlFor="venue-turnaround-space">
              <select
                id="venue-turnaround-space"
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
          </FieldRow>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={scheduled}
              onChange={(event) => setScheduled(event.target.checked)}
            />
            Give it a time window
          </label>

          {scheduled && (
            <FieldRow>
              <Field label="From" htmlFor="venue-turnaround-start">
                <Input
                  id="venue-turnaround-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className={cn(fieldControlClass)}
                />
              </Field>

              <Field label="To" htmlFor="venue-turnaround-end">
                <Input
                  id="venue-turnaround-end"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className={cn(fieldControlClass)}
                />
              </Field>
            </FieldRow>
          )}

          <Field label="Notes" htmlFor="venue-turnaround-notes">
            <Textarea
              id="venue-turnaround-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20"
            />
          </Field>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
