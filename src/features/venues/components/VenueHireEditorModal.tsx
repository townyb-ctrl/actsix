import { FormEvent, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { upsertVenueHire } from "@/features/venues/api/venueHiresApi";
import VenueHireReview from "@/features/venues/components/VenueHireReview";
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
  const [paymentTerms, setPaymentTerms] = useState("");
  const [lessons, setLessons] = useState("");
  const [notes, setNotes] = useState("");
  const [hirerNotes, setHirerNotes] = useState("");
  const [saving, setSaving] = useState(false);
  /**
   * Only new hires get a review. A hire commits rooms, a bond and a contract,
   * and until now it came into existence the moment somebody pressed Save.
   * Editing an existing one is a correction, not a commitment, so it keeps the
   * single step it has always had.
   */
  const [step, setStep] = useState<"details" | "review">("details");

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
    setPaymentTerms(hire?.payment_terms || "");
    setLessons(hire?.lessons_learned || "");
    setNotes(hire?.notes || "");
    setHirerNotes(hire?.hirer_notes || "");
    setStep("details");
  }, [open, hire]);

  const review = (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Give the hire a name");
      return;
    }
    setStep("review");
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();

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
        payment_terms: paymentTerms.trim(),
        lessons_learned: lessons.trim(),
        notes: notes.trim(),
        hirer_notes: hirerNotes.trim(),
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
            {step === "review" ? (
              <Button type="button" variant="outline" onClick={() => setStep("details")}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}

            {step === "review" ? (
              <Button
                type="button"
                disabled={saving}
                onClick={() => save()}
                className="actsix-btn-primary font-bold"
              >
                <Save className="h-4 w-4" />
                {saving ? "Creating…" : "Create the hire"}
              </Button>
            ) : (
              <Button
                type="submit"
                form="venue-hire-form"
                disabled={saving}
                className="actsix-btn-primary font-bold"
              >
                {hire ? <Save className="h-4 w-4" /> : null}
                {hire ? (saving ? "Saving…" : "Save hire") : "Review"}
                {hire ? null : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </>
      }
    >
      {step === "review" ? (
        <VenueHireReview
          name={name.trim()}
          eventType={eventType}
          status={status}
          hirerName={hirerName.trim()}
          hirerEmail={hirerEmail.trim()}
          hirerPhone={hirerPhone.trim()}
          onsiteName={onsiteName.trim()}
          onsitePhone={onsitePhone.trim()}
          paymentTerms={paymentTerms.trim()}
          hirerNotes={hirerNotes.trim()}
          notes={notes.trim()}
        />
      ) : (
      <form id="venue-hire-form" className="space-y-5" onSubmit={hire ? save : review}>
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

        <Field label="Payment terms" htmlFor="venue-hire-terms">
          <input
            id="venue-hire-terms"
            value={paymentTerms}
            onChange={(event) => setPaymentTerms(event.target.value)}
            placeholder="50% on signature, balance 7 days before"
            className={cn(fieldControlClass)}
          />
        </Field>

        <Field
          label="Notes for the hirer"
          htmlFor="venue-hire-hirer-notes"
          badge={
            <Badge variant="outline" className="border-brand-teal/25 bg-brand-teal/8 text-brand-teal">
              They see this
            </Badge>
          }
          hint="Appears on the hirer's own page, under their dates. Nothing else you write on a hire does."
          className="border-t border-border/70 pt-5"
        >
          <textarea
            id="venue-hire-hirer-notes"
            value={hirerNotes}
            onChange={(event) => setHirerNotes(event.target.value)}
            rows={3}
            placeholder="Load in through the side door on Barrack Street. Pieter has the keys from 06:00."
            className={cn(fieldControlClass, "min-h-20 py-2")}
          />
        </Field>

        <Field
          label="Internal notes"
          htmlFor="venue-hire-notes"
          badge={
            <Badge variant="outline" className="border-brand-amber/30 bg-brand-amber/10 text-brand-amber">
              Staff only
            </Badge>
          }
          hint="Never leaves the workspace: not on the hirer's page, not on the printed quote."
        >
          <textarea
            id="venue-hire-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Anything the hirer should never read."
            className={cn(fieldControlClass, "min-h-20 py-2")}
          />
        </Field>

        <Field label="Next time" htmlFor="venue-hire-lessons">
          <textarea
            id="venue-hire-lessons"
            value={lessons}
            onChange={(event) => setLessons(event.target.value)}
            rows={3}
            placeholder="Do it during the school day. Be here Friday night."
            className={cn(fieldControlClass, "min-h-20 py-2")}
          />
          <p className="text-xs text-muted-foreground">
            Carried forward when this hire runs again, so the lesson is not relearned.
          </p>
        </Field>
      </form>
      )}
    </FormDialog>
  );
}
