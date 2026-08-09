import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createHirerContact, deleteVenueBooking, upsertVenueBooking } from "@/features/venues/api/venuesApi";
import {
  findConflicts,
  formatBookingRange,
  type VenueBooking,
  type VenueBookingStatus,
  type VenueBookingType,
  type VenuePaymentStatus,
  type VenueSpace,
} from "@/features/venues/lib/venueBookings";

type Props = {
  open: boolean;
  booking: VenueBooking | null;
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

export default function VenueBookingModal({
  open,
  booking,
  spaces,
  bookings,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {

  const activeSpaces = spaces.filter((space) => space.is_active || space.id === booking?.space_id);

  const [spaceId, setSpaceId] = useState("");
  const [title, setTitle] = useState("");
  const [bookingType, setBookingType] = useState<VenueBookingType>("internal");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [status, setStatus] = useState<VenueBookingStatus>("Confirmed");
  const [hirerName, setHirerName] = useState("");
  const [hirerEmail, setHirerEmail] = useState("");
  const [hirerPhone, setHirerPhone] = useState("");
  const [quotedFee, setQuotedFee] = useState("0");
  const [depositAmount, setDepositAmount] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState<VenuePaymentStatus>("Unpaid");
  const [notes, setNotes] = useState("");
  const [saveHirerAsContact, setSaveHirerAsContact] = useState(false);
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSpaceId(booking?.space_id || activeSpaces[0]?.id || "");
    setTitle(booking?.title || "");
    setBookingType(booking?.booking_type || "internal");
    setStartsAt(booking ? toLocalInput(booking.starts_at) : defaultStart());
    setEndsAt(booking ? toLocalInput(booking.ends_at) : defaultEnd());
    setStatus(booking?.status || "Confirmed");
    setHirerName(booking?.hirer_name || "");
    setHirerEmail(booking?.hirer_email || "");
    setHirerPhone(booking?.hirer_phone || "");
    setQuotedFee(String(booking?.quoted_fee ?? 0));
    setDepositAmount(String(booking?.deposit_amount ?? 0));
    setPaymentStatus(booking?.payment_status && booking.payment_status !== "Not applicable"
      ? booking.payment_status
      : "Unpaid");
    setNotes(booking?.notes || "");
    setSaveHirerAsContact(false);
    setOverrideConflict(false);
  }, [open, booking]);

  /** Pre-fill the fee from the space's daily rate when creating an external hire. */
  useEffect(() => {
    if (booking || bookingType !== "external") return;
    const space = spaces.find((candidate) => candidate.id === spaceId);
    if (space) setQuotedFee(String(space.daily_rate || 0));
  }, [spaceId, bookingType, booking, spaces]);

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
    if (bookingType === "external" && !hirerName.trim()) {
      toast.error("Name the hirer");
      return;
    }
    if (conflicts.length > 0 && !overrideConflict) {
      toast.error("This clashes with another booking", {
        description: "Tick “Book anyway” to keep both.",
      });
      return;
    }

    setSaving(true);

    let hirerContactId = booking?.hirer_contact_id ?? null;

    if (saveHirerAsContact && bookingType === "external" && hirerName.trim()) {
      const { data, error } = await createHirerContact({
        workspaceId,
        userId,
        name: hirerName.trim(),
        email: hirerEmail.trim(),
        phone: hirerPhone.trim(),
      });
      if (error) {
        toast.error("Could not save the hirer as a contact", { description: error.message });
      } else {
        hirerContactId = (data as { id: string })?.id ?? null;
      }
    }

    const { error } = await upsertVenueBooking({
      bookingId: booking?.id,
      workspaceId,
      userId,
      payload: {
        space_id: spaceId,
        title: title.trim(),
        booking_type: bookingType,
        hirer_contact_id: hirerContactId,
        hirer_name: hirerName.trim(),
        hirer_email: hirerEmail.trim(),
        hirer_phone: hirerPhone.trim(),
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        status,
        quoted_fee: Number(quotedFee) || 0,
        deposit_amount: Number(depositAmount) || 0,
        payment_status: paymentStatus,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{booking ? "Booking" : "New booking"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue-booking-space">Space</Label>
              <Select value={spaceId} onValueChange={setSpaceId}>
                <SelectTrigger id="venue-booking-space">
                  <SelectValue placeholder="Choose a space" />
                </SelectTrigger>
                <SelectContent>
                  {activeSpaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-booking-type">Type</Label>
              <Select
                value={bookingType}
                onValueChange={(value) => setBookingType(value as VenueBookingType)}
              >
                <SelectTrigger id="venue-booking-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (no charge)</SelectItem>
                  <SelectItem value="external">External hire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue-booking-title">Title</Label>
            <Input
              id="venue-booking-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={bookingType === "external" ? "Robertson wedding" : "Youth night"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="venue-booking-start">Starts</Label>
              <Input
                id="venue-booking-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-booking-end">Ends</Label>
              <Input
                id="venue-booking-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-booking-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as VenueBookingStatus)}>
                <SelectTrigger id="venue-booking-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Clashes with {conflicts.length === 1 ? "another booking" : `${conflicts.length} bookings`}</AlertTitle>
              <AlertDescription className="space-y-2">
                <ul className="list-disc pl-4 text-sm">
                  {conflicts.map((conflict) => (
                    <li key={conflict.id}>
                      {conflict.title} ({conflict.status.toLowerCase()}) ·{" "}
                      {formatBookingRange(conflict.starts_at, conflict.ends_at)}
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={overrideConflict}
                    onCheckedChange={(checked) => setOverrideConflict(checked === true)}
                  />
                  Book anyway
                </label>
              </AlertDescription>
            </Alert>
          )}

          {bookingType === "external" && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-hirer">Hirer</Label>
                  <Input
                    id="venue-booking-hirer"
                    value={hirerName}
                    onChange={(event) => setHirerName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-email">Email</Label>
                  <Input
                    id="venue-booking-email"
                    type="email"
                    value={hirerEmail}
                    onChange={(event) => setHirerEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-phone">Phone</Label>
                  <Input
                    id="venue-booking-phone"
                    value={hirerPhone}
                    onChange={(event) => setHirerPhone(event.target.value)}
                  />
                </div>
              </div>

              {!booking?.hirer_contact_id && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={saveHirerAsContact}
                    onCheckedChange={(checked) => setSaveHirerAsContact(checked === true)}
                  />
                  Also save this hirer to Service Contacts
                </label>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-fee">Quoted fee</Label>
                  <Input
                    id="venue-booking-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={quotedFee}
                    onChange={(event) => setQuotedFee(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-deposit">Deposit</Label>
                  <Input
                    id="venue-booking-deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-payment">Payment</Label>
                  <Select
                    value={paymentStatus}
                    onValueChange={(value) => setPaymentStatus(value as VenuePaymentStatus)}
                  >
                    <SelectTrigger id="venue-booking-payment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unpaid">Unpaid</SelectItem>
                      <SelectItem value="Deposit paid">Deposit paid</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="venue-booking-notes">Notes</Label>
            <Textarea
              id="venue-booking-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            {booking && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto text-destructive"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

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
