import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteQuoteLine, upsertQuoteLine } from "@/features/venues/api/venueQuotesApi";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import type { VenueResource } from "@/features/venues/lib/venueResources";
import {
  isHeldKind,
  lineTotal,
  VENUE_QUOTE_LINE_KINDS,
  type VenueQuoteLine,
  type VenueQuoteLineKind,
} from "@/features/venues/lib/venueQuotes";

type Props = {
  open: boolean;
  line: VenueQuoteLine | null;
  resources: VenueResource[];
  hireId: string;
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export default function VenueQuoteLineModal({
  open,
  line,
  resources,
  hireId,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [kind, setKind] = useState<VenueQuoteLineKind>("Venue");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(line?.kind || "Venue");
    setDescription(line?.description || "");
    setQuantity(String(line?.quantity ?? 1));
    setUnitPrice(String(line?.unit_price ?? 0));
    setNotes(line?.notes || "");
  }, [open, line]);

  /**
   * Picking from the inventory fills in the description and the price the
   * church already set, so a rate lives in one place rather than being retyped
   * onto every quote. Both stay editable afterwards - a one-off discount or a
   * reworded line should not need a catalogue change.
   */
  const applyResource = (resourceId: string) => {
    const resource = resources.find((candidate) => candidate.id === resourceId);
    if (!resource) return;
    setDescription(resource.name);
    setUnitPrice(String(resource.unit_price));
  };

  const preview = lineTotal({
    quantity: Number(quantity) || 0,
    unit_price: Number(unitPrice) || 0,
  });

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!description.trim()) {
      toast.error("Describe the line");
      return;
    }

    setSaving(true);
    const { error } = await upsertQuoteLine({
      lineId: line?.id,
      workspaceId,
      hireId,
      userId,
      payload: {
        kind,
        description: description.trim(),
        quantity: Math.max(0, Number(quantity) || 0),
        unit_price: Number(unitPrice) || 0,
        notes: notes.trim(),
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the line", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!line) return;

    setDeleting(true);
    const { error } = await deleteQuoteLine(line.id);
    setDeleting(false);

    if (error) {
      toast.error("Could not remove the line", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={line ? "Edit Line" : "New Line"}
      title={line ? "Quote line" : "Add a quote line"}
      description="One charge on this hire's quote."
      footer={
        <>
          {line ? (
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
              form="venue-quote-line-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save line"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-quote-line-form" className="space-y-5" onSubmit={save}>
        <FieldRow>
          <Field label="Kind" htmlFor="venue-quote-kind">
            <select
              id="venue-quote-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as VenueQuoteLineKind)}
              className={cn(fieldControlClass)}
            >
              {VENUE_QUOTE_LINE_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" htmlFor="venue-quote-description">
            <input
              id="venue-quote-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Auditorium, Saturday"
              className={cn(fieldControlClass)}
            />
          </Field>
        </FieldRow>

        {kind === "Resource" && resources.length > 0 && (
          <Field label="Take it from the inventory" htmlFor="venue-quote-resource">
            <select
              id="venue-quote-resource"
              defaultValue=""
              onChange={(event) => applyResource(event.target.value)}
              className={cn(fieldControlClass)}
            >
              <option value="">Choose a resource…</option>
              {resources
                .filter((resource) => resource.is_active)
                .map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                    {resource.is_included ? " (included in the hire)" : ""}
                  </option>
                ))}
            </select>
          </Field>
        )}

        <FieldRow>
          <Field label="Quantity" htmlFor="venue-quote-quantity">
            <input
              id="venue-quote-quantity"
              type="number"
              min="0"
              step="0.5"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>

          <Field label="Price each" htmlFor="venue-quote-price">
            <input
              id="venue-quote-price"
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              className={cn(fieldControlClass)}
            />
          </Field>
        </FieldRow>

        <p className="text-sm text-muted-foreground">
          Line total <span className="font-medium text-foreground">{formatCurrency(preview)}</span>
          {kind === "Discount" && " — taken off the quote"}
          {isHeldKind(kind) && " — held, not charged on top"}
        </p>

        <Field label="Notes" htmlFor="venue-quote-notes" className="border-t border-border/70 pt-5">
          <textarea
            id="venue-quote-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className={cn(fieldControlClass, "min-h-16 py-2")}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
