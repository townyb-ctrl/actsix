import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { upsertVenueSpace } from "@/features/venues/api/venuesApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";

type Props = {
  open: boolean;
  space: VenueSpace | null;
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(space?.name || "");
    setDescription(space?.description || "");
    setCapacity(space?.capacity != null ? String(space.capacity) : "");
    setHourlyRate(String(space?.hourly_rate ?? 0));
    setDailyRate(String(space?.daily_rate ?? 0));
  }, [open, space]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{space ? "Edit space" : "Add space"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="venue-space-name">Name</Label>
            <Input
              id="venue-space-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main Hall"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-space-description">Description</Label>
            <Textarea
              id="venue-space-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="venue-space-capacity">Capacity</Label>
              <Input
                id="venue-space-capacity"
                type="number"
                min="0"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-space-hourly">Hourly hire</Label>
              <Input
                id="venue-space-hourly"
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-space-daily">Daily hire</Label>
              <Input
                id="venue-space-daily"
                type="number"
                min="0"
                step="0.01"
                value={dailyRate}
                onChange={(event) => setDailyRate(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Rates pre-fill the fee on a new external hire. Changing them never alters bookings
            already made.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
