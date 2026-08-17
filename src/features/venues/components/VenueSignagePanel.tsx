import { useState } from "react";
import { Printer, Radio, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  /** Which check-out is being booked back in, and the condition note being typed. */
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");

  const plan = signPlan(links, signs);
  const toPrint = printRunSize(plan);
  const kit = checkoutSummary(checkouts);
  const suggestion = suggestAvPreset(presets, hire.event_type, spaceIds);
  const chosenPreset =
    presets.find((preset) => preset.id === hire.av_preset_id) || null;

  const guard = async (
    action: Promise<{ error: { message: string } | null }>,
    failure: string,
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
      addHireSign({
        workspaceId,
        hireId: hire.id,
        signId: addingSignId,
        userId,
      }),
      "Could not add that sign",
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
      "Could not sign that out",
    );
    setCheckoutResourceId("");
    setCheckoutQuantity("1");
  };

  const unlinked = signs.filter(
    (sign) => sign.is_active && !links.some((link) => link.sign_id === sign.id),
  );

  const resourceName = (resourceId: string) =>
    resources.find((resource) => resource.id === resourceId)?.name ||
    "Unknown item";

  return (
    <section className="st-panel" aria-labelledby="signage-heading">
      <div className="st-panel-head">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="st-panel-title" id="signage-heading">
            Signage, AV &amp; kit
          </h2>
          {toPrint > 0 && <Badge variant="secondary">{toPrint} to print</Badge>}
          {kit.anythingOut && (
            <Badge variant="destructive">{kit.out} still out</Badge>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="min-h-9"
          onClick={onPrintSigns}
          disabled={plan.length === 0}
        >
          <Printer className="h-4 w-4" />
          Print signs
        </Button>
      </div>

      <div className="border-t border-[--st-line-soft] bg-[--st-panel-hi] px-4 py-2">
        <h3 className="label-eyebrow">Signs needed</h3>
      </div>

      {plan.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          None chosen.{" "}
          <Link to="/venues/signage" className="underline">
            Manage the library
          </Link>
          .
        </p>
      ) : (
        plan.map((entry) => (
          <div
            key={entry.link.id}
            className="action-row flex items-center gap-3"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {entry.sign.name}
                </span>
                {entry.needsPrinting && (
                  <Badge variant="secondary">Print</Badge>
                )}
              </span>
              {entry.placement && (
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {entry.placement}
                </span>
              )}
            </span>

            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              × {entry.link.quantity}
            </span>

            <Button
              size="sm"
              variant="ghost"
              className="min-h-9 shrink-0 text-destructive hover:text-destructive"
              onClick={() =>
                guard(removeHireSign(entry.link.id), "Could not remove it")
              }
              aria-label={`Remove ${entry.sign.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}

      <div className="px-4 py-3">
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
            <Button
              size="sm"
              variant="outline"
              className="min-h-9"
              onClick={addSign}
              disabled={!addingSignId}
            >
              Add
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-[--st-line-soft] bg-[--st-panel-hi] px-4 py-2">
        <h3 className="label-eyebrow">AV preset</h3>
      </div>

      <div className="space-y-2 px-4 py-3">
        <select
          value={hire.av_preset_id || ""}
          onChange={(event) =>
            guard(
              setHireAvPreset(hire.id, event.target.value || null),
              "Could not set the preset",
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
                guard(
                  setHireAvPreset(hire.id, suggestion.id),
                  "Could not set the preset",
                )
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
                "Could not save the channels",
              );
            }}
            placeholder="1 front of house · 2 AV · 3 security"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 border-t border-[--st-line-soft] bg-[--st-panel-hi] px-4 py-2">
        <Radio className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="label-eyebrow">Kit signed out</h3>
      </div>

      <div>
        {checkouts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Nothing signed out.
          </p>
        ) : (
          <>
            {checkouts.map((entry) => (
              <div
                key={entry.id}
                className="action-row flex items-center gap-3"
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm ${
                      entry.returned_at
                        ? "text-muted-foreground"
                        : "font-semibold"
                    }`}
                  >
                    {resourceName(entry.resource_id)} × {entry.quantity}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {entry.taken_by || "Unnamed"} ·{" "}
                    {entry.returned_at ? "back" : "still out"}
                    {entry.condition_note && ` · ${entry.condition_note}`}
                  </span>
                </span>
                {!entry.returned_at && returningId !== entry.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-9 transition active:scale-[0.98] motion-reduce:active:scale-100"
                    onClick={() => {
                      setReturningId(entry.id);
                      setReturnNote("");
                    }}
                  >
                    Book in
                  </Button>
                )}
              </div>
            ))}

            {/*
                Booking kit back in asks about its condition inline rather than
                through window.prompt: a native prompt blocks the page, cannot
                be styled or made legible on a phone, and gives no way to see
                the item while typing about it.
              */}
            {returningId && (
              <div className="action-row bg-[--st-panel-hi]">
                <label className="block space-y-1">
                  <span className="label-eyebrow">
                    Condition of{" "}
                    {resourceName(
                      checkouts.find((entry) => entry.id === returningId)
                        ?.resource_id || "",
                    )}
                  </span>
                  <Input
                    value={returnNote}
                    onChange={(event) => setReturnNote(event.target.value)}
                    placeholder="Leave blank if it is fine"
                    autoFocus
                  />
                </label>

                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="actsix-btn-primary transition active:scale-[0.98] motion-reduce:active:scale-100"
                    onClick={async () => {
                      await guard(
                        returnResource(returningId, returnNote.trim()),
                        "Could not book it back in",
                      );
                      setReturningId(null);
                    }}
                  >
                    Book in
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-9"
                    onClick={() => setReturningId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {resources.length > 0 && (
          <div className="flex gap-2 px-4 py-3">
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
            <Button
              size="sm"
              variant="outline"
              className="min-h-9"
              onClick={takeOut}
              disabled={!checkoutResourceId}
            >
              Out
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
