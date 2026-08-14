import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { upsertVenueHire } from "@/features/venues/api/venueHiresApi";
import {
  VENUE_HIRE_STATUSES,
  type VenueHire,
  type VenueHireStatus,
} from "@/features/venues/lib/venueHires";

type Props = {
  open: boolean;
  hire: VenueHire | null;
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (hireId: string) => void;
};

const EVENT_TYPES = [
  "Wedding",
  "Funeral",
  "Conference",
  "Concert",
  "Competition",
  "Community event",
  "Film shoot",
  "Party",
  "Other",
];

export default function VenueHireEditorModal({
  open,
  hire,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("");
  const [status, setStatus] = useState<VenueHireStatus>("Draft");
  const [hirerName, setHirerName] = useState("");
  const [hirerEmail, setHirerEmail] = useState("");
  const [hirerPhone, setHirerPhone] = useState("");
  const [onsiteName, setOnsiteName] = useState("");
  const [onsitePhone, setOnsitePhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(hire?.name || "");
    setEventType(hire?.event_type || "");
    setStatus(hire?.status || "Draft");
    setHirerName(hire?.hirer_name || "");
    setHirerEmail(hire?.hirer_email || "");
    setHirerPhone(hire?.hirer_phone || "");
    setOnsiteName(hire?.onsite_contact_name || "");
    setOnsitePhone(hire?.onsite_contact_phone || "");
    setNotes(hire?.notes || "");
  }, [open, hire]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Give the hire a name");
      return;
    }
    if (!workspaceId || !userId) {
      toast.error("No active workspace");
      return;
    }

    setSaving(true);
    const { data, error } = await upsertVenueHire({
      hireId: hire?.id,
      workspaceId,
      userId,
      payload: {
        name: name.trim(),
        event_type: eventType,
        status,
        hirer_name: hirerName.trim(),
        hirer_email: hirerEmail.trim(),
        hirer_phone: hirerPhone.trim(),
        onsite_contact_name: onsiteName.trim(),
        onsite_contact_phone: onsitePhone.trim(),
        notes: notes.trim(),
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the hire", { description: error.message });
      return;
    }

    const savedId = hire?.id ?? (data as { id: string } | null)?.id ?? "";
    onOpenChange(false);
    onSaved(savedId);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={hire ? "Edit Hire" : "New Hire"}
      title={hire ? "Hire details" : "New hire"}
      description="One event, however many spaces and days it runs across."
      size="lg"
      footer={
        <>
          <div />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="venue-hire-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save hire"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-hire-form" className="space-y-5" onSubmit={save}>
        <FieldGroup title="The event">
          <Field label="Name" htmlFor="venue-hire-name">
            <input
              id="venue-hire-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nationals weekend"
              className={cn(fieldControlClass)}
            />
          </Field>

          <FieldRow>
            <Field label="Event type" htmlFor="venue-hire-type">
              <select
                id="venue-hire-type"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
                className={cn(fieldControlClass)}
              >
                <option value="">Not set</option>
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" htmlFor="venue-hire-status">
              <select
                id="venue-hire-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as VenueHireStatus)}
                className={cn(fieldControlClass)}
              >
                {VENUE_HIRE_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </FieldRow>
        </FieldGroup>

        <FieldGroup title="Who is hiring">
          <FieldRow className="sm:grid-cols-3">
            <Field label="Hirer" htmlFor="venue-hire-hirer">
              <input
                id="venue-hire-hirer"
                value={hirerName}
                onChange={(event) => setHirerName(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Email" htmlFor="venue-hire-email">
              <input
                id="venue-hire-email"
                type="email"
                value={hirerEmail}
                onChange={(event) => setHirerEmail(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Phone" htmlFor="venue-hire-phone">
              <input
                id="venue-hire-phone"
                value={hirerPhone}
                onChange={(event) => setHirerPhone(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>
          </FieldRow>
        </FieldGroup>

        <FieldGroup title="On the day">
          <FieldRow>
            <Field label="On-site contact" htmlFor="venue-hire-onsite">
              <input
                id="venue-hire-onsite"
                value={onsiteName}
                onChange={(event) => setOnsiteName(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Their phone" htmlFor="venue-hire-onsite-phone">
              <input
                id="venue-hire-onsite-phone"
                value={onsitePhone}
                onChange={(event) => setOnsitePhone(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>
          </FieldRow>
          <p className="text-xs text-muted-foreground">
            Who our staff phone on the day. Often not the person who booked.
          </p>
        </FieldGroup>

        <Field label="Notes" htmlFor="venue-hire-notes" className="border-t border-border/70 pt-5">
          <textarea
            id="venue-hire-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className={cn(fieldControlClass, "min-h-20 py-2")}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
