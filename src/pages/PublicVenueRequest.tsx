import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type RequestSpace = {
  id: string;
  name: string;
  description: string;
  capacity: number | null;
};

const LINK_DEAD = "This request link is no longer active.";

const GENERIC_SUBMIT_ERROR = "We could not send your request. Please try again.";

// Exactly the messages submit_venue_enquiry raises
// (supabase/migrations/20260814130000_create_venue_enquiries.sql). Any other RPC
// error text is discarded so raw Postgres internals never reach an anonymous visitor.
const SAFE_SUBMIT_ERRORS = new Set([
  LINK_DEAD,
  "Please fill in the required fields.",
  "The end time must be after the start time.",
  "Too many requests have come in recently. Please try again later.",
  "One of your answers is too long. Please shorten it.",
  "Some of your answers could not be read. Please check the dates and numbers.",
]);

const EVENT_TYPES = [
  "Wedding",
  "Funeral",
  "Conference",
  "Concert",
  "Community event",
  "Film shoot",
  "Party",
  "Other",
];

const INSURANCE_OPTIONS = [
  { value: "Unknown", label: "Not sure yet" },
  { value: "Has cover", label: "We have our own cover" },
  { value: "Needs cover", label: "We need cover arranged" },
] as const;

export default function PublicVenueRequest() {
  const { token } = useParams();

  const [spaces, setSpaces] = useState<RequestSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isForProfit, setIsForProfit] = useState(false);
  const [isTicketed, setIsTicketed] = useState(false);
  const [expectedAttendance, setExpectedAttendance] = useState("");
  const [preferredStart, setPreferredStart] = useState("");
  const [preferredEnd, setPreferredEnd] = useState("");
  const [alternateDates, setAlternateDates] = useState("");
  const [setupNotes, setSetupNotes] = useState("");
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [avNeeds, setAvNeeds] = useState("");
  const [cateringPlan, setCateringPlan] = useState("");
  const [insuranceStatus, setInsuranceStatus] = useState<string>("Unknown");
  const [heardAbout, setHeardAbout] = useState("");

  useEffect(() => {
    const loadSpaces = async () => {
      setLoading(true);
      setError("");

      const { data, error: rpcError } = await (supabase as any).rpc("get_venue_request_spaces", {
        request_token: token || "",
      });

      if (rpcError || !data || (data as RequestSpace[]).length === 0) {
        setError(LINK_DEAD);
        setSpaces([]);
      } else {
        setSpaces(data as RequestSpace[]);
      }

      setLoading(false);
    };

    loadSpaces();
  }, [token]);

  const toggleSpace = (spaceId: string, checked: boolean) => {
    setSpaceIds((current) =>
      checked ? [...current, spaceId] : current.filter((existing) => existing !== spaceId)
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!eventName.trim() || !contactName.trim() || !contactEmail.trim()) {
      setError("Please fill in the required fields.");
      return;
    }
    if (preferredStart && preferredEnd && new Date(preferredEnd) <= new Date(preferredStart)) {
      setError("The end time must be after the start time.");
      return;
    }

    setSubmitting(true);

    const { error: rpcError } = await (supabase as any).rpc("submit_venue_enquiry", {
      request_token: token || "",
      payload: {
        event_name: eventName.trim(),
        event_type: eventType,
        organisation: organisation.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        is_for_profit: isForProfit,
        is_ticketed: isTicketed,
        expected_attendance: expectedAttendance.trim(),
        preferred_start: preferredStart ? new Date(preferredStart).toISOString() : null,
        preferred_end: preferredEnd ? new Date(preferredEnd).toISOString() : null,
        alternate_dates: alternateDates.trim(),
        setup_notes: setupNotes.trim(),
        space_ids: spaceIds,
        description: description.trim(),
        av_needs: avNeeds.trim(),
        catering_plan: cateringPlan.trim(),
        insurance_status: insuranceStatus,
        heard_about: heardAbout.trim(),
      },
    });

    setSubmitting(false);

    if (rpcError) {
      setError(SAFE_SUBMIT_ERRORS.has(rpcError.message) ? rpcError.message : GENERIC_SUBMIT_ERROR);
      return;
    }

    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading the form…</span>
        <span className="st-skeleton block h-7 w-3/5" />
        <span className="st-skeleton block h-3 w-full" />
        {[0, 1, 2, 3].map((field) => (
          <div key={field} className="space-y-2">
            <span className="st-skeleton block h-3 w-24" />
            <span className="st-skeleton block h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-muted-foreground">{LINK_DEAD}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <h1 className="text-xl font-semibold">Enquiry sent</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thank you. Someone will read through it and come back to you about availability and cost.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Enquire about hiring a space</h1>
        <p className="text-sm text-muted-foreground">
          Tell us what you are planning. The more you can share, the faster we can come back with
          availability and a cost.
        </p>
      </div>

      <form
        className="space-y-8 [&_input]:min-h-11 [&_select]:min-h-11 [&_textarea]:min-h-24"
        onSubmit={submit}
      >
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your event
          </h2>

          <div className="space-y-2">
            <Label htmlFor="enquiry-event-name">Event name</Label>
            <Input
              id="enquiry-event-name"
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="enquiry-event-type">Event type</Label>
              <select
                id="enquiry-event-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option value="">Choose one</option>
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="enquiry-attendance">Expected attendance</Label>
              <Input
                id="enquiry-attendance"
                type="number"
                min="0"
                value={expectedAttendance}
                onChange={(event) => setExpectedAttendance(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="enquiry-description">What do you want to run?</Label>
            <Textarea
              id="enquiry-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enquiry-for-profit"
                checked={isForProfit}
                onCheckedChange={(checked) => setIsForProfit(checked === true)}
              />
              <Label htmlFor="enquiry-for-profit" className="font-normal">
                This is a for-profit event
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="enquiry-ticketed"
                checked={isTicketed}
                onCheckedChange={(checked) => setIsTicketed(checked === true)}
              />
              <Label htmlFor="enquiry-ticketed" className="font-normal">
                We are selling tickets
              </Label>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            When
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="enquiry-start">Preferred start</Label>
              <Input
                id="enquiry-start"
                type="datetime-local"
                value={preferredStart}
                onChange={(event) => setPreferredStart(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enquiry-end">Preferred end</Label>
              <Input
                id="enquiry-end"
                type="datetime-local"
                value={preferredEnd}
                onChange={(event) => setPreferredEnd(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="enquiry-alternates">Alternative dates that would also work</Label>
            <Input
              id="enquiry-alternates"
              value={alternateDates}
              onChange={(event) => setAlternateDates(event.target.value)}
              placeholder="The following Saturday, or any evening that week"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="enquiry-setup">Setup and pack-down time you need</Label>
            <Input
              id="enquiry-setup"
              value={setupNotes}
              onChange={(event) => setSetupNotes(event.target.value)}
              placeholder="Two hours before, an hour after"
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Spaces you are interested in
          </h2>

          <div className="space-y-2">
            {spaces.map((space) => (
              <div key={space.id} className="flex items-start gap-2">
                <Checkbox
                  id={`enquiry-space-${space.id}`}
                  checked={spaceIds.includes(space.id)}
                  onCheckedChange={(checked) => toggleSpace(space.id, checked === true)}
                />
                <Label htmlFor={`enquiry-space-${space.id}`} className="font-normal">
                  {space.name}
                  {space.capacity ? ` (seats ${space.capacity})` : ""}
                  {space.description && (
                    <span className="block text-xs text-muted-foreground">{space.description}</span>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            What you need from us
          </h2>

          <div className="space-y-2">
            <Label htmlFor="enquiry-av">Sound, screens, lighting, live feed</Label>
            <Textarea
              id="enquiry-av"
              rows={2}
              value={avNeeds}
              onChange={(event) => setAvNeeds(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="enquiry-catering">Catering plan</Label>
            <Textarea
              id="enquiry-catering"
              rows={2}
              value={cateringPlan}
              onChange={(event) => setCateringPlan(event.target.value)}
              placeholder="Own caterer, food trucks, or guests eating on site"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="enquiry-insurance">Insurance</Label>
            <select
              id="enquiry-insurance"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={insuranceStatus}
              onChange={(event) => setInsuranceStatus(event.target.value)}
            >
              {INSURANCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            About you
          </h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="enquiry-contact-name">Your name</Label>
              <Input
                id="enquiry-contact-name"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enquiry-contact-email">Email</Label>
              <Input
                id="enquiry-contact-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enquiry-contact-phone">Phone</Label>
              <Input
                id="enquiry-contact-phone"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="enquiry-organisation">Organisation (if any)</Label>
              <Input
                id="enquiry-organisation"
                value={organisation}
                onChange={(event) => setOrganisation(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enquiry-heard-about">How did you hear about us?</Label>
              <Input
                id="enquiry-heard-about"
                value={heardAbout}
                onChange={(event) => setHeardAbout(event.target.value)}
              />
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="min-h-12 w-full transition active:scale-[0.99] motion-reduce:active:scale-100"
        >
          {submitting ? "Sending…" : "Send enquiry"}
        </Button>
      </form>
    </div>
  );
}
