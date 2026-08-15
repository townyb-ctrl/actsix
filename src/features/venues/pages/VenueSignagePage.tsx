import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useVenueSpaces } from "@/features/venues/api/venuesQueries";
import {
  deleteAvPreset,
  deleteVenueSign,
  upsertAvPreset,
  upsertVenueSign,
} from "@/features/venues/api/venueSignageApi";
import { useAvPresets, useVenueSigns } from "@/features/venues/api/venueSignageQueries";
import type { VenueAvPreset, VenueSign } from "@/features/venues/lib/venueSignage";

export default function VenueSignagePage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const { signs } = useVenueSigns(workspace?.id);
  const { presets } = useAvPresets(workspace?.id);
  const { spaces } = useVenueSpaces(workspace?.id);

  const [newSign, setNewSign] = useState({ name: "", placement: "", body: "" });
  const [newPreset, setNewPreset] = useState({ name: "", eventType: "", routing: "" });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-signs"] });
    queryClient.invalidateQueries({ queryKey: ["venue-av-presets"] });
  };

  const addSign = async () => {
    if (!newSign.name.trim()) {
      toast.error("Give the sign a name");
      return;
    }

    const { error } = await upsertVenueSign({
      workspaceId: workspace?.id || "",
      userId: user?.id || "",
      payload: {
        name: newSign.name.trim(),
        placement: newSign.placement.trim(),
        body: newSign.body.trim(),
      },
    });

    if (error) {
      toast.error("Could not add the sign", { description: error.message });
      return;
    }
    setNewSign({ name: "", placement: "", body: "" });
    refresh();
  };

  const toggleSign = async (sign: VenueSign, payload: Partial<VenueSign>) => {
    const { error } = await upsertVenueSign({
      signId: sign.id,
      workspaceId: workspace?.id || "",
      userId: user?.id || "",
      payload,
    });
    if (error) {
      toast.error("Could not update the sign", { description: error.message });
      return;
    }
    refresh();
  };

  const removeSign = async (sign: VenueSign) => {
    const { error } = await deleteVenueSign(sign.id);
    if (error) {
      toast.error("Could not remove the sign", { description: error.message });
      return;
    }
    refresh();
  };

  const addPreset = async () => {
    if (!newPreset.name.trim()) {
      toast.error("Give the preset a name");
      return;
    }

    const { error } = await upsertAvPreset({
      workspaceId: workspace?.id || "",
      userId: user?.id || "",
      payload: {
        name: newPreset.name.trim(),
        event_type: newPreset.eventType.trim(),
        routing: newPreset.routing.trim(),
      },
    });

    if (error) {
      toast.error("Could not add the preset", { description: error.message });
      return;
    }
    setNewPreset({ name: "", eventType: "", routing: "" });
    refresh();
  };

  const savePreset = async (preset: VenueAvPreset, payload: Partial<VenueAvPreset>) => {
    const { error } = await upsertAvPreset({
      presetId: preset.id,
      workspaceId: workspace?.id || "",
      userId: user?.id || "",
      payload,
    });
    if (error) {
      toast.error("Could not update the preset", { description: error.message });
      return;
    }
    refresh();
  };

  const removePreset = async (preset: VenueAvPreset) => {
    const { error } = await deleteAvPreset(preset.id);
    if (error) {
      toast.error("Could not remove the preset", { description: error.message });
      return;
    }
    refresh();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire"
        title="Signage & AV"
        subtitle="Signs the church owns, and how the room is usually set up."
        actions={
          <Button variant="outline" className="min-h-10" asChild>
            <Link to="/venues">
              <ArrowLeft className="h-4 w-4" />
              Bookings
            </Link>
          </Button>
        }
      />

      <div className="actsix-page-body grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No signs yet. Add the ones the church puts out again and again.
              </p>
            ) : (
              <ul className="space-y-2">
                {signs.map((sign) => (
                  <li key={sign.id} className="rounded-[var(--radius-control)] border p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{sign.name}</span>
                      <div className="flex items-center gap-2">
                        {!sign.exists_physically && <Badge variant="secondary">Not printed</Badge>}
                        {sign.needs_reprint && <Badge variant="destructive">Reprint</Badge>}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeSign(sign)}
                          aria-label={`Remove ${sign.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {sign.placement && (
                      <p className="text-xs text-muted-foreground">Goes: {sign.placement}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={sign.exists_physically}
                          onChange={(event) =>
                            toggleSign(sign, { exists_physically: event.target.checked })
                          }
                        />
                        We have it
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={sign.needs_reprint}
                          onChange={(event) =>
                            toggleSign(sign, { needs_reprint: event.target.checked })
                          }
                        />
                        Needs reprint
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 border-t pt-3">
              <Input
                value={newSign.name}
                onChange={(event) => setNewSign({ ...newSign, name: event.target.value })}
                placeholder="Sign name"
              />
              <Input
                value={newSign.placement}
                onChange={(event) => setNewSign({ ...newSign, placement: event.target.value })}
                placeholder="Where it goes"
              />
              <Textarea
                value={newSign.body}
                onChange={(event) => setNewSign({ ...newSign, body: event.target.value })}
                placeholder="What it says, so it can be reprinted"
                className="min-h-16"
              />
              <Button size="sm" variant="outline" onClick={addSign}>
                <Plus className="h-4 w-4" />
                Add sign
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AV presets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {presets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No presets yet. Write down the usual setup for an event type so nobody has to
                remember it.
              </p>
            ) : (
              <ul className="space-y-2">
                {presets.map((preset) => (
                  <li key={preset.id} className="rounded-[var(--radius-control)] border p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{preset.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removePreset(preset)}
                        aria-label={`Remove ${preset.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {preset.event_type || "Any event type"}
                    </p>

                    <select
                      value={preset.space_id || ""}
                      onChange={(event) =>
                        savePreset(preset, { space_id: event.target.value || null })
                      }
                      aria-label="Space"
                      className="mt-2 h-8 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-2 text-xs"
                    >
                      <option value="">Any space</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name}
                        </option>
                      ))}
                    </select>

                    <textarea
                      defaultValue={preset.routing}
                      onBlur={(event) => {
                        if (event.target.value === preset.routing) return;
                        savePreset(preset, { routing: event.target.value.trim() });
                      }}
                      placeholder="Routing: what plugs into what"
                      className="mt-2 min-h-14 w-full rounded-[var(--radius-control)] border border-border/70 bg-background p-2 text-sm"
                    />

                    <textarea
                      defaultValue={preset.changeover_steps}
                      onBlur={(event) => {
                        if (event.target.value === preset.changeover_steps) return;
                        savePreset(preset, { changeover_steps: event.target.value.trim() });
                      }}
                      placeholder="Changeover steps back to the Sunday setup"
                      className="mt-2 min-h-14 w-full rounded-[var(--radius-control)] border border-border/70 bg-background p-2 text-sm"
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 border-t pt-3">
              <Input
                value={newPreset.name}
                onChange={(event) => setNewPreset({ ...newPreset, name: event.target.value })}
                placeholder="Preset name"
              />
              <Input
                value={newPreset.eventType}
                onChange={(event) => setNewPreset({ ...newPreset, eventType: event.target.value })}
                placeholder="Event type it suits"
              />
              <Textarea
                value={newPreset.routing}
                onChange={(event) => setNewPreset({ ...newPreset, routing: event.target.value })}
                placeholder="Routing"
                className="min-h-16"
              />
              <Button size="sm" variant="outline" onClick={addPreset}>
                <Plus className="h-4 w-4" />
                Add preset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
