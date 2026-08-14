import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Save, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, FieldGroup, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { deleteVenueBooking, upsertVenueBooking } from "@/features/venues/api/venuesApi";
import {
  findConflicts,
  formatBookingRange,
  type VenueBooking,
  type VenueBookingStatus,
  type VenueSpace,
} from "@/features/venues/lib/venueBookings";

type Props = {
  open: boolean;
  booking: VenueBooking | null;
  spaces: VenueSpace[];
  bookings: VenueBooking[];
  /** Set when the booking is being created inside a hire, so it attaches to it. */
  hireId?: string | null;
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

const defaultStart = () => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return toLocalInput(start.toISOString());
};

const defaultEnd = () => {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  end.setHours(end.getHours() + 3);
  return toLocalInput(end.toISOString());
};

const spaceFieldId = "venue-booking-space";
const typeFieldId = "venue-booking-type";
const titleFieldId = "venue-booking-title";
const startFieldId = "venue-booking-start";
const endFieldId = "venue-booking-end";
const statusFieldId = "venue-booking-status";
const hirerFieldId = "venue-booking-hirer";
const emailFieldId = "venue-booking-email";
const phoneFieldId = "venue-booking-phone";
const feeFieldId = "venue-booking-fee";
const depositFieldId = "venue-booking-deposit";
const paymentFieldId = "venue-booking-payment";
const notesFieldId = "venue-booking-notes";

export default function VenueBookingModal({
  open,
  booking,
  spaces,
  bookings,
  hireId,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const activeSpaces = spaces.filter((space) => space.is_active || space.id === booking?.space_id);

  const [spaceId, setSpaceId] = useState("");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [status, setStatus] = useState<VenueBookingStatus>("Confirmed");
  const [notes, setNotes] = useState("");
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSpaceId(booking?.space_id || activeSpaces[0]?.id || "");
    setTitle(booking?.title || "");
    setStartsAt(booking ? toLocalInput(booking.starts_at) : defaultStart());
    setEndsAt(booking ? toLocalInput(booking.ends_at) : defaultEnd());
    setStatus(booking?.status || "Confirmed");
    setNotes(booking?.notes || "");
    setOverrideConflict(false);
  }, [open, booking]);

  const conflicts = useMemo(() => {
    if (!spaceId || !startsAt || !endsAt) return [];
    return findConflicts(
      { id: booking?.id, spaceId, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt) },
      bookings
    );
  }, [spaceId, startsAt, endsAt, bookings, booking?.id]);

  const conflictIds = conflicts.map((conflict) => conflict.id).sort().join(",");

  /** A tick only acknowledges the clash set it was ticked for - a changed set needs a fresh tick. */
  useEffect(() => {
    setOverrideConflict(false);
  }, [conflictIds]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!spaceId) {
      toast.error("Choose a space");
      return;
    }
    if (!title.trim()) {
      toast.error("Give the booking a title");
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
    if (conflicts.length > 0 && !overrideConflict) {
      toast.error("This clashes with another booking", {
        description: "Tick “Book anyway” to keep both.",
      });
      return;
    }

    setSaving(true);

    /*
     * Money lives on the hire, not here: a booking is in-house use of a space.
     * An existing booking keeps whatever type and fees it was already saved
     * with, so editing an older external booking through this form can never
     * silently zero its price. A new one is external when it belongs to a hire
     * and internal when it stands alone.
     */
    const { error } = await upsertVenueBooking({
      bookingId: booking?.id,
      workspaceId,
      userId,
      payload: {
        space_id: spaceId,
        hire_id: booking ? booking.hire_id : hireId ?? null,
        title: title.trim(),
        booking_type: booking ? booking.booking_type : hireId ? "external" : "internal",
        hirer_contact_id: booking?.hirer_contact_id ?? null,
        hirer_name: booking?.hirer_name ?? "",
        hirer_email: booking?.hirer_email ?? "",
        hirer_phone: booking?.hirer_phone ?? "",
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        status,
        quoted_fee: booking?.quoted_fee ?? 0,
        deposit_amount: booking?.deposit_amount ?? 0,
        payment_status: booking?.payment_status ?? "Not applicable",
        requested_features: booking?.requested_features ?? [],
        needs_technician: booking?.needs_technician ?? false,
        technician_fee: booking?.technician_fee ?? 0,
        coffee_requested: booking?.coffee_requested ?? false,
        coffee_fee: booking?.coffee_fee ?? 0,
        notes: notes.trim(),
      },
    });

    setSaving(false);

    if (error) {
      toast.error("Could not save the booking", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  const confirmDelete = async () => {
    if (!booking) return;

    setDeleting(true);
    const { error } = await deleteVenueBooking(booking.id);
    setDeleting(false);

    if (error) {
      toast.error("Could not delete the booking", { description: error.message });
      return;
    }

    setConfirmDeleteOpen(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        eyebrow={booking ? "Edit Booking" : "New Booking"}
        title={booking ? "Booking details" : "New booking"}
        description="Book a space internally, or record an external hire with its fee and payment status."
        size="lg"
        footer={
          <>
            {booking ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mr-auto text-destructive hover:text-destructive"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete booking
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
                form="venue-booking-form"
                disabled={saving}
                className="actsix-btn-primary font-bold"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save booking"}
              </Button>
            </div>
          </>
        }
      >
        <form id="venue-booking-form" className="space-y-5" onSubmit={save}>
          <FieldGroup title="Booking">
            <Field label="Space" htmlFor={spaceFieldId}>
                <select
                  id={spaceFieldId}
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
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Title" htmlFor={titleFieldId}>
              <input
                id={titleFieldId}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Youth night"
                className={cn(fieldControlClass)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Starts" htmlFor={startFieldId}>
                <input
                  id={startFieldId}
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className={cn(fieldControlClass)}
                />
              </Field>

              <Field label="Ends" htmlFor={endFieldId}>
                <input
                  id={endFieldId}
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className={cn(fieldControlClass)}
                />
              </Field>

              <Field label="Status" htmlFor={statusFieldId}>
                <select
                  id={statusFieldId}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as VenueBookingStatus)}
                  className={cn(fieldControlClass)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </Field>
            </div>
          </FieldGroup>

          {conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                Clashes with {conflicts.length === 1 ? "another booking" : `${conflicts.length} bookings`}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <ul className="list-disc pl-4 text-sm">
                  {conflicts.map((conflict) => (
                    <li key={conflict.id}>
                      {conflict.title} ({conflict.status.toLowerCase()}) ·{" "}
                      {formatBookingRange(conflict.starts_at, conflict.ends_at)}
                    </li>
                  ))}
                </ul>
                <CheckboxField
                  id="venue-booking-override-conflict"
                  label="Book anyway"
                  checked={overrideConflict}
                  onCheckedChange={setOverrideConflict}
                  className="text-sm font-normal"
                />
              </AlertDescription>
            </Alert>
          )}

          <Field label="Notes" htmlFor={notesFieldId} className="border-t border-border/70 pt-5">
            <textarea
              id={notesFieldId}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className={cn(fieldControlClass, "min-h-16 py-2")}
            />
          </Field>
        </form>
      </FormDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{title}”. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-brand-danger text-white hover:bg-brand-danger/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
