import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckboxField, Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deletePayment, upsertPayment } from "@/features/venues/api/venuePaymentsApi";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import {
  VENUE_PAYMENT_METHODS,
  type VenuePayment,
  type VenuePaymentKind,
  type VenuePaymentMethod,
} from "@/features/venues/lib/venuePayments";

type Props = {
  open: boolean;
  payment: VenuePayment | null;
  hireId: string;
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function VenuePaymentModal({
  open,
  payment,
  hireId,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [kind, setKind] = useState<VenuePaymentKind>("Payment");
  const [amount, setAmount] = useState("0");
  const [isRefund, setIsRefund] = useState(false);
  const [paidOn, setPaidOn] = useState(todayIso);
  const [method, setMethod] = useState<VenuePaymentMethod>("EFT");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(payment?.kind || "Payment");
    // A stored refund is a negative row; the form shows it as a positive amount
    // with the refund box ticked, which is how a person thinks about it.
    setAmount(String(Math.abs(payment?.amount ?? 0)));
    setIsRefund((payment?.amount ?? 0) < 0);
    setPaidOn(payment?.paid_on || todayIso());
    setMethod(payment?.method || "EFT");
    setReference(payment?.reference || "");
    setNotes(payment?.notes || "");
  }, [open, payment]);

  const signedAmount = (Number(amount) || 0) * (isRefund ? -1 : 1);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!Number(amount)) {
      toast.error("Enter an amount");
      return;
    }
    if (!paidOn) {
      toast.error("Set the date it was paid");
      return;
    }

    setSaving(true);
    const { error } = await upsertPayment({
      paymentId: payment?.id,
      workspaceId,
      hireId,
      userId,
      payload: {
        kind,
        amount: signedAmount,
        paid_on: paidOn,
        method,
        reference: reference.trim(),
        notes: notes.trim(),
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the payment", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!payment) return;

    setDeleting(true);
    const { error } = await deletePayment(payment.id);
    setDeleting(false);

    if (error) {
      toast.error("Could not remove the payment", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  const refundLabel = kind === "Bond" ? "This is the bond going back" : "This is a refund";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={payment ? "Edit Payment" : "Record Payment"}
      title={payment ? "Payment" : "Record a payment"}
      description="What actually landed in the account. ACTSIX does not take payments."
      footer={
        <>
          {payment ? (
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
              form="venue-payment-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-payment-form" className="space-y-5" onSubmit={save}>
        <FieldRow>
          <Field label="What is it" htmlFor="venue-payment-kind">
            <select
              id="venue-payment-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as VenuePaymentKind)}
              className={cn(fieldControlClass)}
            >
              <option value="Payment">Payment towards the hire</option>
              <option value="Bond">Security bond (held)</option>
            </select>
          </Field>

          <Field label="Amount" htmlFor="venue-payment-amount">
            <input
              id="venue-payment-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>
        </FieldRow>

        <CheckboxField
          id="venue-payment-refund"
          label={refundLabel}
          checked={isRefund}
          onCheckedChange={setIsRefund}
        />

        <FieldRow>
          <Field label="Date paid" htmlFor="venue-payment-date">
            <input
              id="venue-payment-date"
              type="date"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>

          <Field label="Method" htmlFor="venue-payment-method">
            <select
              id="venue-payment-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as VenuePaymentMethod)}
              className={cn(fieldControlClass)}
            >
              {VENUE_PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </FieldRow>

        <p className="text-sm text-muted-foreground">
          Recorded as{" "}
          <span className="font-medium text-foreground">{formatCurrency(signedAmount)}</span>
          {kind === "Bond" && " — held, and never counted as income"}
        </p>

        <Field label="Reference" htmlFor="venue-payment-reference">
          <input
            id="venue-payment-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="EFT reference on the statement"
            className={cn(fieldControlClass)}
          />
        </Field>

        <Field label="Notes" htmlFor="venue-payment-notes">
          <input
            id="venue-payment-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={cn(fieldControlClass)}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
