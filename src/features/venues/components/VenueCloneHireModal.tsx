import { FormEvent, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { cloneHire } from "@/features/venues/api/venuePostEventApi";
import { planClone, type CloneSource } from "@/features/venues/lib/venueClone";
import type { VenueHire } from "@/features/venues/lib/venueHires";

type Props = {
  open: boolean;
  hire: VenueHire;
  source: CloneSource;
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
};

/** Same date next year, as a sensible starting guess for an annual event. */
const sameDayNextYear = (iso?: string) => {
  const base = iso ? new Date(iso) : new Date();
  const next = new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());
  const month = String(next.getMonth() + 1).padStart(2, "0");
  return `${next.getFullYear()}-${month}-${String(next.getDate()).padStart(2, "0")}`;
};

export default function VenueCloneHireModal({
  open,
  hire,
  source,
  workspaceId,
  userId,
  onOpenChange,
}: Props) {
  const navigate = useNavigate();
  const firstBooking = source.bookings.find((booking) => booking.status !== "Cancelled");

  const [name, setName] = useState("");
  const [startDay, setStartDay] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(`${hire.name} (repeat)`);
    setStartDay(sameDayNextYear(firstBooking?.starts_at));
  }, [open, hire.name, firstBooking?.starts_at]);

  const plan = startDay ? planClone(source, startDay) : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Give the repeat a name");
      return;
    }
    if (!startDay) {
      toast.error("Pick the day it starts on");
      return;
    }

    setSaving(true);
    const { hireId, error } = await cloneHire({
      workspaceId,
      userId,
      name: name.trim(),
      startDay,
      hire,
      source,
    });
    setSaving(false);

    if (error) {
      toast.error(
        hireId
          ? "The repeat was created but not everything copied across"
          : "Could not create the repeat",
        { description: error.message }
      );
      if (hireId) navigate(`/venues/hires/${hireId}`);
      return;
    }

    toast.success("Repeat created as a draft");
    onOpenChange(false);
    if (hireId) navigate(`/venues/hires/${hireId}`);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Repeat Hire"
      title="Run this again"
      description="Copies the rooms, times, price, run sheet and staffing shape onto new dates. Nothing that already happened comes across."
      footer={
        <div className="ml-auto grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="venue-clone-form"
            disabled={saving}
            className="actsix-btn-primary font-bold"
          >
            <Copy className="h-4 w-4" />
            {saving ? "Creating…" : "Create repeat"}
          </Button>
        </div>
      }
    >
      <form id="venue-clone-form" className="space-y-5" onSubmit={submit}>
        <FieldRow>
          <Field label="Name" htmlFor="venue-clone-name">
            <Input
              id="venue-clone-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>

          <Field label="First day" htmlFor="venue-clone-start">
            <Input
              id="venue-clone-start"
              type="date"
              value={startDay}
              onChange={(event) => setStartDay(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>
        </FieldRow>

        {plan && (
          <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/30 p-3 text-sm">
            <p className="font-medium">What comes across</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>
                {plan.bookings.length} {plan.bookings.length === 1 ? "booking" : "bookings"}, moved{" "}
                {plan.offsetDays} {Math.abs(plan.offsetDays) === 1 ? "day" : "days"} and kept at the
                same times
              </li>
              <li>
                {plan.lines.length} quote {plan.lines.length === 1 ? "line" : "lines"} at today's
                prices
              </li>
              <li>
                {plan.runSheetItems.length} run sheet{" "}
                {plan.runSheetItems.length === 1 ? "item" : "items"}
              </li>
              <li>
                {plan.positions.length} {plan.positions.length === 1 ? "position" : "positions"}, with
                nobody assigned yet
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Payments, the signed contract and the debrief stay with the hire that already ran. The
              repeat starts as a draft.
            </p>
          </div>
        )}
      </form>
    </FormDialog>
  );
}
