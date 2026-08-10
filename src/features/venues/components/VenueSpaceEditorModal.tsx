import { FormEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckboxField, Field, FieldGroup, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { upsertVenueSpace } from "@/features/venues/api/venuesApi";
import { uploadVenueSpacePhoto } from "@/features/venues/lib/uploadVenueSpacePhoto";
import { VENUE_SPACE_FEATURES, type VenueSpace } from "@/features/venues/lib/venueBookings";

type Props = {
  open: boolean;
  space: VenueSpace | null;
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

/** Fixed palette so the calendar's chip colours stay legible and distinct - no free-form picker. */
const SPACE_COLOR_PALETTE = [
  { value: "#0d9488", label: "Teal" },
  { value: "#d97706", label: "Amber" },
  { value: "#0284c7", label: "Sky" },
  { value: "#e11d48", label: "Rose" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#059669", label: "Emerald" },
  { value: "#ea580c", label: "Orange" },
  { value: "#475569", label: "Slate" },
];

const nameFieldId = "venue-space-name";
const descriptionFieldId = "venue-space-description";
const capacityFieldId = "venue-space-capacity";
const hourlyFieldId = "venue-space-hourly";
const dailyFieldId = "venue-space-daily";

export default function VenueSpaceEditorModal({
  open,
  space,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [dailyRate, setDailyRate] = useState("0");
  const [color, setColor] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(space?.name || "");
    setDescription(space?.description || "");
    setCapacity(space?.capacity != null ? String(space.capacity) : "");
    setHourlyRate(String(space?.hourly_rate ?? 0));
    setDailyRate(String(space?.daily_rate ?? 0));
    setColor(space?.color || "");
    setFeatures(space?.features || []);
    setPhotoUrls(space?.photo_urls || []);
  }, [open, space]);

  const toggleFeature = (feature: string, checked: boolean) => {
    setFeatures((current) =>
      checked ? [...current, feature] : current.filter((existing) => existing !== feature)
    );
  };

  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploadingPhoto(true);
    const result = await uploadVenueSpacePhoto({ file, workspaceId, userId });
    setUploadingPhoto(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setPhotoUrls((current) => [...current, result.url]);
  };

  const removePhoto = (url: string) => {
    setPhotoUrls((current) => current.filter((existing) => existing !== url));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Give the space a name");
      return;
    }
    if (!workspaceId || !userId) {
      toast.error("No active workspace");
      return;
    }

    setSaving(true);
    const { error } = await upsertVenueSpace({
      spaceId: space?.id,
      workspaceId,
      userId,
      payload: {
        name: name.trim(),
        description: description.trim(),
        capacity: capacity.trim() ? Number(capacity) : null,
        hourly_rate: Number(hourlyRate) || 0,
        daily_rate: Number(dailyRate) || 0,
        color,
        features,
        photo_urls: photoUrls,
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the space", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={space ? "Edit Space" : "Add Space"}
      title={space ? "Space details" : "New space"}
      description="The rooms and halls that can be booked or hired."
      footer={
        <>
          <div />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="venue-space-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save space"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-space-form" className="space-y-5" onSubmit={save}>
        <FieldGroup title="Space identity">
          <Field label="Name" htmlFor={nameFieldId}>
            <input
              id={nameFieldId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main Hall"
              className={cn(fieldControlClass)}
            />
          </Field>

          <Field label="Description" htmlFor={descriptionFieldId}>
            <textarea
              id={descriptionFieldId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className={cn(fieldControlClass, "min-h-16 py-2")}
            />
          </Field>
        </FieldGroup>

        <FieldGroup title="Photos">
          <div className="flex flex-wrap gap-2">
            {photoUrls.map((url) => (
              <div key={url} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-[0.75rem] border border-border/70">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  aria-label="Remove photo"
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => photoFileRef.current?.click()}
              className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-[0.75rem] border border-dashed border-border/70 text-muted-foreground transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="text-[10px] font-bold">{uploadingPhoto ? "…" : "Add"}</span>
            </button>

            <input
              ref={photoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void addPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Give people booking this space an idea of what it looks like.
          </p>
        </FieldGroup>

        <FieldGroup title="Capacity & rates">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Capacity" htmlFor={capacityFieldId}>
              <input
                id={capacityFieldId}
                type="number"
                min="0"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Hourly hire" htmlFor={hourlyFieldId}>
              <input
                id={hourlyFieldId}
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Daily hire" htmlFor={dailyFieldId}>
              <input
                id={dailyFieldId}
                type="number"
                min="0"
                step="0.01"
                value={dailyRate}
                onChange={(event) => setDailyRate(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            Rates pre-fill the fee on a new external hire. Changing them never alters bookings
            already made.
          </p>
        </FieldGroup>

        <FieldGroup title="Features">
          <div className="grid gap-2 sm:grid-cols-2">
            {VENUE_SPACE_FEATURES.map((feature) => (
              <CheckboxField
                key={feature}
                id={`venue-space-feature-${feature}`}
                label={feature}
                checked={features.includes(feature)}
                onCheckedChange={(checked) => toggleFeature(feature, checked)}
                className="text-sm font-normal"
              />
            ))}
          </div>
        </FieldGroup>

        <FieldGroup title="Calendar colour">
          <Field label="Colour">
            <div className="flex flex-wrap items-center gap-2">
              {SPACE_COLOR_PALETTE.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  onClick={() => setColor(swatch.value)}
                  aria-label={`${swatch.label} calendar colour`}
                  aria-pressed={color === swatch.value}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-[border-color,transform] duration-100 ease-out active:scale-90 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50 focus-visible:ring-offset-1",
                    color === swatch.value ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: swatch.value }}
                />
              ))}
              {color && (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setColor("")}>
                  Clear
                </Button>
              )}
            </div>
          </Field>
          <p className="text-xs text-muted-foreground">
            Shown on booking chips in the venue calendar. No colour set falls back to a neutral grey.
          </p>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
