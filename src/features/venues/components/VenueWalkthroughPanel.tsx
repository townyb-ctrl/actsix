import { useRef, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteWalkthrough,
  upsertWalkthrough,
} from "@/features/venues/api/venueTurnaroundApi";
import { uploadVenueSpacePhoto } from "@/features/venues/lib/uploadVenueSpacePhoto";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";
import {
  walkthroughCoverage,
  type VenueWalkthrough,
  type VenueWalkthroughPhase,
} from "@/features/venues/lib/venueTurnaround";

type Props = {
  walkthroughs: VenueWalkthrough[];
  spaces: VenueSpace[];
  hireId: string;
  workspaceId: string;
  userId: string;
  walkedBy: string;
  onChanged: () => void;
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export default function VenueWalkthroughPanel({
  walkthroughs,
  spaces,
  hireId,
  workspaceId,
  userId,
  walkedBy,
  onChanged,
}: Props) {
  const coverage = walkthroughCoverage(walkthroughs);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const spaceName = (spaceId: string | null) =>
    spaceId ? spaces.find((space) => space.id === spaceId)?.name || "Unknown space" : "Whole venue";

  const addWalkthrough = async (phase: VenueWalkthroughPhase) => {
    const { error } = await upsertWalkthrough({
      workspaceId,
      hireId,
      userId,
      payload: { phase, walked_by: walkedBy, space_id: null },
    });
    if (error) {
      toast.error("Could not start the walkthrough", { description: error.message });
      return;
    }
    onChanged();
  };

  const updateRow = async (row: VenueWalkthrough, payload: Parameters<typeof upsertWalkthrough>[0]["payload"]) => {
    const { error } = await upsertWalkthrough({
      walkthroughId: row.id,
      workspaceId,
      hireId,
      userId,
      payload,
    });
    if (error) {
      toast.error("Could not save the walkthrough", { description: error.message });
      return false;
    }
    onChanged();
    return true;
  };

  const addPhoto = async (row: VenueWalkthrough, file: File) => {
    setBusyId(row.id);
    const result = await uploadVenueSpacePhoto({ file, workspaceId, userId });

    if ("error" in result) {
      setBusyId(null);
      toast.error(result.error);
      return;
    }

    await updateRow(row, { photo_urls: [...row.photo_urls, result.url] });
    setBusyId(null);
  };

  const remove = async (row: VenueWalkthrough) => {
    const { error } = await deleteWalkthrough(row.id);
    if (error) {
      toast.error("Could not remove the walkthrough", { description: error.message });
      return;
    }
    onChanged();
  };

  const renderRows = (rows: VenueWalkthrough[], phase: VenueWalkthroughPhase) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="label-eyebrow">{phase === "Before" ? "Before they arrive" : "After they leave"}</span>
        <Button size="sm" variant="ghost" onClick={() => addWalkthrough(phase)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing recorded.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-[var(--radius-control)] border border-border/70 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-medium">{spaceName(row.space_id)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatWhen(row.walked_at)}
                    {row.walked_by && ` · ${row.walked_by}`}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <input
                    ref={(element) => {
                      fileInputs.current[row.id] = element;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) addPhoto(row, file);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.id}
                    onClick={() => fileInputs.current[row.id]?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    {busyId === row.id ? "Uploading…" : "Photo"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(row)}
                    aria-label="Remove walkthrough"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <select
                value={row.space_id || ""}
                onChange={(event) => updateRow(row, { space_id: event.target.value || null })}
                aria-label="Space"
                className="mt-2 h-8 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-2 text-xs"
              >
                <option value="">Whole venue</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>

              <textarea
                defaultValue={row.condition_notes}
                onBlur={async (event) => {
                  // Blur-saving is invisible, so say it landed. Only when the
                  // text actually changed - a toast on every focus loss is noise.
                  if (event.target.value === row.condition_notes) return;
                  const saved = await updateRow(row, {
                    condition_notes: event.target.value.trim(),
                  });
                  if (saved) toast.success("Notes saved");
                }}
                placeholder="What state is it in"
                className="mt-2 min-h-14 w-full rounded-[var(--radius-control)] border border-border/70 bg-background p-2 text-sm"
              />

              {row.photo_urls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.photo_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt="Walkthrough"
                        className="h-16 w-16 rounded object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Condition walkthrough</CardTitle>
        <Badge variant={coverage.bothEndsCaptured ? "default" : "secondary"}>
          {coverage.bothEndsCaptured
            ? `Both ends · ${coverage.photoCount} ${coverage.photoCount === 1 ? "photo" : "photos"}`
            : "Incomplete"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A bond argument needs both ends. Walk the rooms before they arrive and again after they
          leave, and photograph anything that matters.
        </p>

        {renderRows(coverage.before, "Before")}
        <div className="border-t pt-3">{renderRows(coverage.after, "After")}</div>
      </CardContent>
    </Card>
  );
}
