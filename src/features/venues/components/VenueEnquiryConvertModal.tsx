import { FormEvent, useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { linkEnquiryToBooking } from "@/features/venues/api/venueEnquiriesApi";
import { upsertVenueBooking } from "@/features/venues/api/venuesApi";
import type { VenueEnquiry } from "@/features/venues/lib/venueEnquiries";
import { findConflicts, formatBookingRange, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";

type Props = {
  open: boolean;
  enquiry: VenueEnquiry;
  spaces: VenueSpace[];
  bookings: VenueBooking[];
  workspaceId: string;
  userId: string;
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

export default function VenueEnquiryConvertModal({
  open,
  enquiry,
  spaces,
  bookings,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const activeSpaces = spaces.filter((space) => space.is_active);

  const [spaceId, setSpaceId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Prefer a space the enquirer actually asked for; fall back to the first bookable one.
    const requested = activeSpaces.find((space) => enquiry.space_ids.includes(space.id));
    setSpaceId(requested?.id || activeSpaces[0]?.id || "");
    setStartsAt(enquiry.preferred_start ? toLocalInput(enquiry.preferred_start) : "");
    setEndsAt(enquiry.preferred_end ? toLocalInput(enquiry.preferred_end) : "");
  }, [open, enquiry, spaces]);

  const conflicts =
    spaceId && startsAt && endsAt
      ? findConflicts(
          { spaceId, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt) },
          bookings
        )
      : [];

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!spaceId) {
      toast.error("Choose a space");
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

    const { data, error } = await upsertVenueBooking({
      workspaceId,
      userId,
      payload: {
        space_id: spaceId,
        title: enquiry.event_name,
        booking_type: "external",
        hirer_name: enquiry.contact_name,
        hirer_email: enquiry.contact_email,
        hirer_phone: enquiry.contact_phone,
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        status: "Pending",
        notes: enquiry.description,
      },
    });

    if (error) {
      setSaving(false);
      toast.error("Could not create the booking", { description: error.message });
      return;
    }

    const bookingId = (data as { id: string } | null)?.id;

    // The booking exists by now, so a failed link is reported without pretending
    // nothing happened - the coordinator can see the booking on /venues either way.
    const { error: linkError } = bookingId
      ? await linkEnquiryToBooking(enquiry.id, bookingId)
      : { error: null };

    setSaving(false);

    if (linkError) {
      toast.error("Created the booking, but the enquiry did not update", {
        description: linkError.message,
      });
    } else {
      toast.success("Booking created from this enquiry");
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Accept Enquiry"
      title="Turn this enquiry into a booking"
      description="Creates a pending booking against one space. Add the other spaces they asked for as separate bookings."
      footer={
        <>
          <div />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="venue-enquiry-convert-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <CalendarCheck className="h-4 w-4" />
              {saving ? "Creating…" : "Create booking"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-enquiry-convert-form" className="space-y-5" onSubmit={save}>
        <Field label="Space" htmlFor="venue-convert-space">
          <select
            id="venue-convert-space"
            value={spaceId}
            onChange={(event) => setSpaceId(event.target.value)}
            className={cn(fieldControlClass)}
          >
            <option value="" disabled>
              Choose a space
            </option>
            {activeSpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
                {enquiry.space_ids.includes(space.id) ? " — they asked for this" : ""}
              </option>
            ))}
          </select>
        </Field>

        <FieldRow>
          <Field label="Starts" htmlFor="venue-convert-start">
            <input
              id="venue-convert-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>

          <Field label="Ends" htmlFor="venue-convert-end">
            <input
              id="venue-convert-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>
        </FieldRow>

        {conflicts.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription className="space-y-1">
              <p>This clashes with an existing booking. It will still be created as pending.</p>
              <ul className="list-disc pl-4 text-sm">
                {conflicts.map((conflict) => (
                  <li key={conflict.id}>
                    {conflict.title} · {formatBookingRange(conflict.starts_at, conflict.ends_at)}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          The booking starts as Pending with the hirer's details and a zero fee. Price it on the
          booking itself.
        </p>
      </form>
    </FormDialog>
  );
}
