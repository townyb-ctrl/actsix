import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteIncident, upsertIncident } from "@/features/venues/api/venueSafetyApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";
import {
  VENUE_INCIDENT_CATEGORIES,
  VENUE_INCIDENT_SEVERITIES,
  type VenueIncident,
  type VenueIncidentCategory,
  type VenueIncidentSeverity,
} from "@/features/venues/lib/venueSafety";

type Props = {
  open: boolean;
  incident: VenueIncident | null;
  spaces: VenueSpace[];
  hireId: string;
  workspaceId: string;
  userId: string;
  reportedBy: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function VenueIncidentModal({
  open,
  incident,
  spaces,
  hireId,
  workspaceId,
  userId,
  reportedBy,
  onOpenChange,
  onSaved,
}: Props) {
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<VenueIncidentSeverity>("Minor");
  const [category, setCategory] = useState<VenueIncidentCategory>("Other");
  const [spaceId, setSpaceId] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [reporter, setReporter] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;

    setSummary(incident?.summary || "");
    setSeverity(incident?.severity || "Minor");
    setCategory(incident?.category || "Other");
    setSpaceId(incident?.space_id || "");
    setOccurredAt(toLocalInput(incident?.occurred_at || new Date().toISOString()));
    setActionTaken(incident?.action_taken || "");
    setReporter(incident?.reported_by || reportedBy);
  }, [open, incident, reportedBy]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!summary.trim()) {
      toast.error("Say what happened");
      return;
    }

    setSaving(true);
    const { error } = await upsertIncident({
      incidentId: incident?.id,
      workspaceId,
      hireId,
      userId,
      payload: {
        summary: summary.trim(),
        severity,
        category,
        space_id: spaceId || null,
        occurred_at: new Date(occurredAt).toISOString(),
        action_taken: actionTaken.trim(),
        reported_by: reporter.trim(),
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the incident", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!incident) return;

    setDeleting(true);
    const { error } = await deleteIncident(incident.id);
    setDeleting(false);

    if (error) {
      toast.error("Could not remove the incident", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={incident ? "Edit Incident" : "Log Incident"}
      title={incident ? "Incident" : "Log an incident"}
      description="What happened, when, and what was done about it."
      footer={
        <>
          {incident ? (
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
              form="venue-incident-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save incident"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-incident-form" className="space-y-5" onSubmit={save}>
        <FieldGroup title="What happened">
          <Field label="Summary" htmlFor="venue-incident-summary">
            <Input
              id="venue-incident-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="A guest slipped on the foyer floor"
              className={cn(fieldControlClass)}
            />
          </Field>

          <FieldRow>
            <Field label="How serious" htmlFor="venue-incident-severity">
              <select
                id="venue-incident-severity"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as VenueIncidentSeverity)}
                className={cn(fieldControlClass)}
              >
                {VENUE_INCIDENT_SEVERITIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kind" htmlFor="venue-incident-category">
              <select
                id="venue-incident-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as VenueIncidentCategory)}
                className={cn(fieldControlClass)}
              >
                {VENUE_INCIDENT_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Where" htmlFor="venue-incident-space">
              <select
                id="venue-incident-space"
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

            <Field label="When" htmlFor="venue-incident-when">
              <Input
                id="venue-incident-when"
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>
          </FieldRow>

          <Field label="What was done" htmlFor="venue-incident-action">
            <Textarea
              id="venue-incident-action"
              value={actionTaken}
              onChange={(event) => setActionTaken(event.target.value)}
              className="min-h-20"
            />
          </Field>

          <Field label="Reported by" htmlFor="venue-incident-reporter">
            <Input
              id="venue-incident-reporter"
              value={reporter}
              onChange={(event) => setReporter(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
