import { FormEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckboxField, Field, FieldGroup, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { upsertVenueSpace } from "@/features/venues/api/venuesApi";
import { removeSpaceResource, setSpaceResource } from "@/features/venues/api/venueResourcesApi";
import { uploadVenueSpacePhoto } from "@/features/venues/lib/uploadVenueSpacePhoto";
import { type VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueResource, VenueSpaceResource } from "@/features/venues/lib/venueResources";

type Props = {
  open: boolean;
  space: VenueSpace | null;
  resources: VenueResource[];
  spaceResources: VenueSpaceResource[];
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
const seatedFieldId = "venue-space-seated";
const standingFieldId = "venue-space-standing";
const hourlyFieldId = "venue-space-hourly";
const dailyFieldId = "venue-space-daily";
const setupFieldId = "venue-space-setup";
const packdownFieldId = "venue-space-packdown";

export default function VenueSpaceEditorModal({
  open,
  space,
  resources,
  spaceResources,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [seatedCapacity, setSeatedCapacity] = useState("");
  const [standingCapacity, setStandingCapacity] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [dailyRate, setDailyRate] = useState("0");
  const [setupMinutes, setSetupMinutes] = useState("0");
  const [packdownMinutes, setPackdownMinutes] = useState("0");
  const [hireableStandalone, setHireableStandalone] = useState(true);
  const [foodAllowed, setFoodAllowed] = useState(true);
  const [isRestrictedZone, setIsRestrictedZone] = useState(false);
  const [color, setColor] = useState("");
  /** resource id -> how many of it this space comes with. */
  const [resourceQuantities, setResourceQuantities] = useState<Record<string, number>>({});
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoFileRef = useRef<HTMLInputElement | null>(null);

  const activeResources = resources.filter((resource) => resource.is_active);

  useEffect(() => {
    if (!open) return;
    setName(space?.name || "");
    setDescription(space?.description || "");
    setCapacity(space?.capacity != null ? String(space.capacity) : "");
    setSeatedCapacity(space?.seated_capacity != null ? String(space.seated_capacity) : "");
    setStandingCapacity(space?.standing_capacity != null ? String(space.standing_capacity) : "");
    setHourlyRate(String(space?.hourly_rate ?? 0));
    setDailyRate(String(space?.daily_rate ?? 0));
    setSetupMinutes(String(space?.setup_minutes ?? 0));
    setPackdownMinutes(String(space?.packdown_minutes ?? 0));
    setHireableStandalone(space?.hireable_standalone ?? true);
    setFoodAllowed(space?.food_allowed ?? true);
    setIsRestrictedZone(space?.is_restricted_zone ?? false);
    setColor(space?.color || "");
    setPhotoUrls(space?.photo_urls || []);
    setResourceQuantities(
      Object.fromEntries(
        spaceResources
          .filter((link) => link.space_id === space?.id)
          .map((link) => [link.resource_id, link.quantity])
      )
    );
  }, [open, space, spaceResources]);

  const toggleResource = (resourceId: string, checked: boolean) => {
    setResourceQuantities((current) => {
      if (!checked) {
        const { [resourceId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [resourceId]: current[resourceId] ?? 1 };
    });
  };

  const setResourceQuantity = (resourceId: string, value: string) => {
    setResourceQuantities((current) => ({
      ...current,
      [resourceId]: Math.max(0, Number(value) || 0),
    }));
  };

  /**
   * Links are reconciled against what the space had when the modal opened:
   * everything ticked is upserted, everything unticked since is deleted.
   */
  const saveResourceLinks = async (savedSpaceId: string) => {
    const previous = spaceResources.filter((link) => link.space_id === savedSpaceId);

    const removals = previous
      .filter((link) => !(link.resource_id in resourceQuantities))
      .map((link) => removeSpaceResource({ spaceId: savedSpaceId, resourceId: link.resource_id }));

    const upserts = Object.entries(resourceQuantities).map(([resourceId, quantity]) =>
      setSpaceResource({ workspaceId, spaceId: savedSpaceId, resourceId, quantity })
    );

    const results = await Promise.all([...removals, ...upserts]);
    return results.find((result) => result?.error)?.error ?? null;
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
    const { data, error } = await upsertVenueSpace({
      spaceId: space?.id,
      workspaceId,
      userId,
      payload: {
        name: name.trim(),
        description: description.trim(),
        capacity: capacity.trim() ? Number(capacity) : null,
        seated_capacity: seatedCapacity.trim() ? Number(seatedCapacity) : null,
        standing_capacity: standingCapacity.trim() ? Number(standingCapacity) : null,
        hourly_rate: Number(hourlyRate) || 0,
        daily_rate: Number(dailyRate) || 0,
        setup_minutes: Math.max(0, Number(setupMinutes) || 0),
        packdown_minutes: Math.max(0, Number(packdownMinutes) || 0),
        hireable_standalone: hireableStandalone,
        food_allowed: foodAllowed,
        is_restricted_zone: isRestrictedZone,
        color,
        photo_urls: photoUrls,
      },
    });

    if (error) {
      setSaving(false);
      toast.error("Could not save the space", { description: error.message });
      return;
    }

    const savedSpaceId = space?.id ?? (data as { id: string } | null)?.id;

    // The space itself is saved by this point, so a link failure is reported
    // without discarding that - the user reopens and retries the resources.
    const linkError = savedSpaceId ? await saveResourceLinks(savedSpaceId) : null;
    setSaving(false);

    if (linkError) {
      toast.error("Saved the space, but its resources did not update", {
        description: (linkError as { message: string }).message,
      });
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

            <Field label="Seated" htmlFor={seatedFieldId}>
              <input
                id={seatedFieldId}
                type="number"
                min="0"
                value={seatedCapacity}
                onChange={(event) => setSeatedCapacity(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Standing" htmlFor={standingFieldId}>
              <input
                id={standingFieldId}
                type="number"
                min="0"
                value={standingCapacity}
                onChange={(event) => setStandingCapacity(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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

        <FieldGroup title="Turnaround & rules">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Setup (minutes)" htmlFor={setupFieldId}>
              <input
                id={setupFieldId}
                type="number"
                min="0"
                value={setupMinutes}
                onChange={(event) => setSetupMinutes(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Pack-down (minutes)" htmlFor={packdownFieldId}>
              <input
                id={packdownFieldId}
                type="number"
                min="0"
                value={packdownMinutes}
                onChange={(event) => setPackdownMinutes(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <CheckboxField
              id="venue-space-standalone"
              label="Can be hired on its own"
              checked={hireableStandalone}
              onCheckedChange={setHireableStandalone}
              className="text-sm font-normal"
            />
            <CheckboxField
              id="venue-space-food"
              label="Food allowed"
              checked={foodAllowed}
              onCheckedChange={setFoodAllowed}
              className="text-sm font-normal"
            />
            <CheckboxField
              id="venue-space-restricted"
              label="Staff-only zone during hires"
              checked={isRestrictedZone}
              onCheckedChange={setIsRestrictedZone}
              className="text-sm font-normal"
            />
          </div>
        </FieldGroup>

        <FieldGroup title="Resources in this space">
          {activeResources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No resources yet. Add tables, chairs, and AV kit under Venue Hire → Resources, then
              tick the ones that live in this space.
            </p>
          ) : (
            <div className="space-y-2">
              {activeResources.map((resource) => {
                const checked = resource.id in resourceQuantities;

                return (
                  <div key={resource.id} className="flex items-center justify-between gap-3">
                    <CheckboxField
                      id={`venue-space-resource-${resource.id}`}
                      label={resource.name}
                      checked={checked}
                      onCheckedChange={(next) => toggleResource(resource.id, next)}
                      className="text-sm font-normal"
                    />
                    {checked && (
                      <input
                        type="number"
                        min="0"
                        aria-label={`How many ${resource.name} in this space`}
                        value={resourceQuantities[resource.id]}
                        onChange={(event) => setResourceQuantity(resource.id, event.target.value)}
                        className={cn(fieldControlClass, "h-9 w-24")}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
