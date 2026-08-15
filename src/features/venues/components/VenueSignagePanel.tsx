import { useState } from "react";
import { Printer, Radio, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addHireSign,
  checkOutResource,
  removeHireSign,
  returnResource,
  setHireAvPreset,
  setHireWalkieChannels,
  updateHireSign,
} from "@/features/venues/api/venueSignageApi";
import type { VenueResource } from "@/features/venues/lib/venueResources";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import {
  checkoutSummary,
  printRunSize,
  signPlan,
  suggestAvPreset,
  type VenueAvPreset,
  type VenueHireSign,
  type VenueResourceCheckout,
  type VenueSign,
} from "@/features/venues/lib/venueSignage";

type Props = {
  hire: VenueHire;
  signs: VenueSign[];
  links: VenueHireSign[];
  presets: VenueAvPreset[];
  resources: VenueResource[];
  checkouts: VenueResourceCheckout[];
  spaceIds: string[];
  workspaceId: string;
  userId: string;
  takenBy: string;
  onPrintSigns: () => void;
  onChanged: () => void;
};

export default function VenueSignagePanel({
  hire,
  signs,
  links,
  presets,
  resources,
  checkouts,
  spaceIds,
  workspaceId,
  userId,
  takenBy,
  onPrintSigns,
  onChanged,
}: Props) {
  const [addingSignId, setAddingSignId] = useState("");
  const [checkoutResourceId, setCheckoutResourceId] = useState("");
  const [checkoutQuantity, setCheckoutQuantity] = useState("1");
  const [channels, setChannels] = useState(hire.walkie_channels);

  const plan = signPlan(links, signs);
  const toPrint = printRunSize(plan);
  const kit = checkoutSummary(checkouts);
  const suggestion = suggestAvPreset(presets, hire.event_type, spaceIds);
  const chosenPreset = presets.find((preset) => preset.id === hire.av_preset_id) || null;

  const guard = async (
    action: Promise<{ error: { message: string } | null }>,
    failure: string
  ) => {
    const { error } = await action;
    if (error) {
      toast.error(failure, { description: error.message });
      return;
    }
    onChanged();
  };

  const addSign = async () => {
    if (!addingSignId) return;
    await guard(
      addHireSign({ workspaceId, hireId: hire.id, signId: addingSignId, userId }),
      "Could not add that sign"
    );
    setAddingSignId("");
  };

  const takeOut = async () => {
    if (!checkoutResourceId) return;
    await guard(
      checkOutResource({
        workspaceId,
        hireId: hire.id,
        resourceId: checkoutResourceId,
        userId,
        quantity: Math.max(1, Number(checkoutQuantity) || 1),
        takenBy,
      }),
      "Could not sign that out"
    );
    setCheckoutResourceId("");
    setCheckoutQuantity("1");
  };

  const unlinked = signs.filter(
    (sign) => sign.is_active && !links.some((link) => link.sign_id === sign.id)
  );

  const resourceName = (resourceId: string) =>
    resources.find((resource) => resource.id === resourceId)?.name || "Unknown item";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Signage, AV &amp; kit</CardTitle>
          {toPrint > 0 && <Badge variant="secondary">{toPrint} to print</Badge>}
          {kit.anythingOut && <Badge variant="destructive">{kit.out} still out</Badge>}
        </div>

        <Button size="sm" variant="outline" onClick={onPrintSigns} disabled={plan.length === 0}>
          <Printer className="h-4 w-4" />
          Print signs
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <span className="label-eyebrow">Signs needed</span>

          {plan.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None chosen.{" "}
              <Link to="/venues/signage" className="underline">
                Manage the library
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {plan.map((entry) => (
                <li key={entry.link.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{entry.sign.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      × {entry.link.quantity}
                      {entry.placement && ` · ${entry.placement}`}
                    </span>
                    {entry.needsPrinting && (
                      <Badge variant="secondary" className="ml-2">
                        Print
                      </Badge>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => guard(removeHireSign(entry.link.id), "Could not remove it")}
                    aria-label={`Remove ${entry.sign.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {unlinked.length > 0 && (
            <div className="flex gap-2">
              <select
                value={addingSignId}
                onChange={(event) => setAddingSignId(event.target.value)}
                aria-label="Add a sign"
                className="h-8 flex-1 rounded-[var(--radius-control)] border border-border/70 bg-background px-2 text-xs"
              >
                <option value="">Add a sign…</option>
                {unlinked.map((sign) => (
                  <option key={sign.id} value={sign.id}>
                    {sign.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={addSign} disabled={!addingSignId}>
                Add
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <span className="label-eyebrow">AV preset</span>

          <select
            value={hire.av_preset_id || ""}
            onChange={(event) =>
              guard(
                setHireAvPreset(hire.id, event.target.value || null),
                "Could not set the preset"
              )
            }
            aria-label="AV preset"
            className="h-8 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-2 text-xs"
          >
            <option value="">No preset</option>
            {presets
              .filter((preset) => preset.is_active)
              .map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
          </select>

          {!hire.av_preset_id && suggestion && (
            <p className="text-xs text-muted-foreground">
              “{suggestion.name}” usually fits a {hire.event_type.toLowerCase()}.{" "}
              <button
                type="button"
                className="underline"
                onClick={() =>
                  guard(setHireAvPreset(hire.id, suggestion.id), "Could not set the preset")
                }
              >
                Use it
              </button>
            </p>
          )}

          {chosenPreset?.routing && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {chosenPreset.routing}
            </p>
          )}
          {chosenPreset?.changeover_steps && (
            <div className="text-sm">
              <p className="label-eyebrow">Changeover back</p>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {chosenPreset.changeover_steps}
              </p>
            </div>
          )}

          <label className="block space-y-1">
            <span className="label-eyebrow">Walkie channels</span>
            <Input
              value={channels}
              onChange={(event) => setChannels(event.target.value)}
              onBlur={() => {
                if (channels === hire.walkie_channels) return;
                guard(
                  setHireWalkieChannels(hire.id, channels.trim()),
                  "Could not save the channels"
                );
              }}
              placeholder="1 front of house · 2 AV · 3 security"
            />
          </label>
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <span className="label-eyebrow">Kit signed out</span>
          </div>

          {checkouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing signed out.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {checkouts.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className={entry.returned_at ? "text-muted-foreground" : "font-medium"}>
                      {resourceName(entry.resource_id)} × {entry.quantity}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.taken_by || "Unnamed"} ·{" "}
                      {entry.returned_at ? "back" : "still out"}
                      {entry.condition_note && ` · ${entry.condition_note}`}
                    </span>
                  </span>
                  {!entry.returned_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const note = window.prompt("Any damage or notes? Leave blank if fine.", "");
                        // A cancelled prompt means they changed their mind, so
                        // nothing is booked back in.
                        if (note === null) return;
                        guard(returnResource(entry.id, note.trim()), "Could not book it back in");
                      }}
                    >
                      Book in
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {resources.length > 0 && (
            <div className="flex gap-2">
              <select
                value={checkoutResourceId}
                onChange={(event) => setCheckoutResourceId(event.target.value)}
                aria-label="Sign out kit"
                className="h-8 flex-1 rounded-[var(--radius-control)] border border-border/70 bg-background px-2 text-xs"
              >
                <option value="">Sign something out…</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="1"
                value={checkoutQuantity}
                onChange={(event) => setCheckoutQuantity(event.target.value)}
                className="h-8 w-16"
                aria-label="How many"
              />
              <Button size="sm" variant="outline" onClick={takeOut} disabled={!checkoutResourceId}>
                Out
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
