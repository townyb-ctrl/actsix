import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckboxField, Field, FieldGroup, FieldRow, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { upsertVenueResource } from "@/features/venues/api/venueResourcesApi";
import type { VenueResource } from "@/features/venues/lib/venueResources";

type Props = {
  open: boolean;
  resource: VenueResource | null;
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

/** Suggested groupings, typed freely - churches own kit we cannot anticipate. */
const CATEGORY_SUGGESTIONS = [
  "Furniture",
  "AV",
  "Kitchen",
  "Cafe",
  "Signage",
  "Safety",
  "Space feature",
];

const nameFieldId = "venue-resource-name";
const categoryFieldId = "venue-resource-category";
const quantityFieldId = "venue-resource-quantity";
const unitFieldId = "venue-resource-unit";
const priceFieldId = "venue-resource-price";
const notesFieldId = "venue-resource-notes";

export default function VenueResourceEditorModal({
  open,
  resource,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState("");
  const [isIncluded, setIsIncluded] = useState(true);
  const [unitPrice, setUnitPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(resource?.name || "");
    setCategory(resource?.category || "");
    setQuantity(String(resource?.quantity ?? 0));
    setUnit(resource?.unit || "");
    setIsIncluded(resource?.is_included ?? true);
    setUnitPrice(String(resource?.unit_price ?? 0));
    setNotes(resource?.notes || "");
  }, [open, resource]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Give the resource a name");
      return;
    }
    if (!workspaceId || !userId) {
      toast.error("No active workspace");
      return;
    }

    setSaving(true);
    const { error } = await upsertVenueResource({
      resourceId: resource?.id,
      workspaceId,
      userId,
      payload: {
        name: name.trim(),
        category: category.trim(),
        quantity: Math.max(0, Number(quantity) || 0),
        unit: unit.trim(),
        is_included: isIncluded,
        // A price on an included resource would never be charged, so it is not stored.
        unit_price: isIncluded ? 0 : Number(unitPrice) || 0,
        notes: notes.trim(),
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the resource", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={resource ? "Edit Resource" : "Add Resource"}
      title={resource ? "Resource details" : "New resource"}
      description="Tables, chairs, AV kit, kitchen equipment — what a hire can ask for."
      footer={
        <>
          <div />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="venue-resource-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save resource"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-resource-form" className="space-y-5" onSubmit={save}>
        <FieldGroup title="What it is">
          <FieldRow>
            <Field label="Name" htmlFor={nameFieldId}>
              <input
                id={nameFieldId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Round tables"
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Category" htmlFor={categoryFieldId}>
              <input
                id={categoryFieldId}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Furniture"
                list="venue-resource-categories"
                className={cn(fieldControlClass)}
              />
              <datalist id="venue-resource-categories">
                {CATEGORY_SUGGESTIONS.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </Field>
          </FieldRow>
        </FieldGroup>

        <FieldGroup title="How many">
          <FieldRow>
            <Field label="Quantity owned" htmlFor={quantityFieldId}>
              <input
                id={quantityFieldId}
                type="number"
                min="0"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Unit" htmlFor={unitFieldId}>
              <input
                id={unitFieldId}
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="each"
                className={cn(fieldControlClass)}
              />
            </Field>
          </FieldRow>
          <p className="text-xs text-muted-foreground">
            Leave the quantity at 0 for anything you do not count.
          </p>
        </FieldGroup>

        <FieldGroup title="Charging">
          <CheckboxField
            id="venue-resource-included"
            label="Included in the hire fee"
            checked={isIncluded}
            onCheckedChange={setIsIncluded}
          />

          {!isIncluded && (
            <Field label="Price per unit" htmlFor={priceFieldId}>
              <input
                id={priceFieldId}
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>
          )}
        </FieldGroup>

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
  );
}
