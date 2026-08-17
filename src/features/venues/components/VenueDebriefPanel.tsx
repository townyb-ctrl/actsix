import { useState } from "react";
import { Copy, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveHireDebrief } from "@/features/venues/api/venuePostEventApi";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import {
  hireOutcome,
  isDebriefStarted,
} from "@/features/venues/lib/venueDebrief";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import type { VenuePayment } from "@/features/venues/lib/venuePayments";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

type Props = {
  hire: VenueHire;
  lines: VenueQuoteLine[];
  payments: VenuePayment[];
  onClone: () => void;
  onSaved: () => void;
};

const todayIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${String(now.getDate()).padStart(2, "0")}`;
};

const Row = ({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) => (
  <div
    className={cn(
      "flex justify-between gap-3",
      strong && "font-semibold",
      muted && "text-muted-foreground",
    )}
  >
    <dt className="text-xs">{label}</dt>
    <dd className="font-mono text-xs tabular-nums">{value}</dd>
  </div>
);

export default function VenueDebriefPanel({
  hire,
  lines,
  payments,
  onClone,
  onSaved,
}: Props) {
  const [notes, setNotes] = useState(hire.debrief_notes);
  const [lessons, setLessons] = useState(hire.lessons_learned);
  const [damageFound, setDamageFound] = useState(hire.damage_found);
  const [damageCost, setDamageCost] = useState(String(hire.damage_cost ?? 0));
  const [rating, setRating] = useState<number | null>(hire.hirer_rating);
  const [hostAgain, setHostAgain] = useState<boolean | null>(
    hire.would_host_again,
  );
  const [saving, setSaving] = useState(false);

  const cost = Number(damageCost) || 0;
  const outcome = hireOutcome(lines, payments, cost);
  const started = isDebriefStarted(hire);

  const save = async () => {
    setSaving(true);
    const { error } = await saveHireDebrief(hire.id, {
      debrief_notes: notes.trim(),
      lessons_learned: lessons.trim(),
      damage_found: damageFound.trim(),
      damage_cost: Math.max(0, cost),
      hirer_rating: rating,
      would_host_again: hostAgain,
      debrief_completed_on: hire.debrief_completed_on || todayIso(),
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the debrief", { description: error.message });
      return;
    }
    toast.success("Debrief saved");
    onSaved();
  };

  return (
    <section className="st-panel" aria-labelledby="debrief-heading">
      <div className="st-panel-head">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="st-panel-title" id="debrief-heading">
            After the event
          </h2>
          <Badge variant={started ? "default" : "secondary"}>
            {started ? "Debriefed" : "Not debriefed"}
          </Badge>
        </div>

        <Button size="sm" variant="ghost" className="min-h-9" onClick={onClone}>
          <Copy className="h-4 w-4" />
          Repeat this hire
        </Button>
      </div>

      <dl className="space-y-1 px-4 py-3">
        <Row label="Quoted" value={formatCurrency(outcome.charged)} />
        <Row label="Received" value={formatCurrency(outcome.received)} />
        {outcome.refunded > 0 && (
          <Row
            label="Refunded"
            value={formatCurrency(outcome.refunded)}
            muted
          />
        )}
        {outcome.outstanding !== 0 && (
          <Row
            label={outcome.outstanding > 0 ? "Still owed" : "Owed back"}
            value={formatCurrency(Math.abs(outcome.outstanding))}
          />
        )}
        {outcome.bondHeld !== 0 && (
          <Row
            label="Bond to return"
            value={formatCurrency(outcome.bondToReturn)}
            muted
          />
        )}
        {outcome.unrecoveredDamage > 0 && (
          <Row
            label="Damage the bond did not cover"
            value={formatCurrency(outcome.unrecoveredDamage)}
            muted
          />
        )}
        <Row label="Net" value={formatCurrency(outcome.net)} strong />
      </dl>

      <div className="space-y-3 border-t border-[--st-line-soft] px-4 py-4">
        <div className="space-y-1">
          <span className="label-eyebrow">How were they to host</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} out of 5`}
                aria-pressed={rating === value}
                onClick={() => setRating(rating === value ? null : value)}
                className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
              >
                <Star
                  className={cn(
                    "h-5 w-5",
                    rating !== null && value <= rating
                      ? "fill-brand-amber text-brand-amber"
                      : "text-muted-foreground",
                  )}
                />
              </button>
            ))}
            {rating !== null && (
              <button
                type="button"
                onClick={() => setRating(null)}
                className="ml-2 text-xs text-muted-foreground underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <span className="label-eyebrow">Have them back</span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((option) => (
              <Button
                key={option.label}
                type="button"
                size="sm"
                variant={hostAgain === option.value ? "default" : "outline"}
                onClick={() =>
                  setHostAgain(hostAgain === option.value ? null : option.value)
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="label-eyebrow">Damage found</span>
          <Textarea
            value={damageFound}
            onChange={(event) => setDamageFound(event.target.value)}
            placeholder="Nothing, or what broke and where"
            className="min-h-16"
          />
        </label>

        <label className="block space-y-1">
          <span className="label-eyebrow">Cost to put right</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={damageCost}
            onChange={(event) => setDamageCost(event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="label-eyebrow">How it went</span>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20"
          />
        </label>

        <label className="block space-y-1">
          <span className="label-eyebrow">Do differently next time</span>
          <Textarea
            value={lessons}
            onChange={(event) => setLessons(event.target.value)}
            placeholder="Carried across when this hire is repeated"
            className="min-h-16"
          />
        </label>

        <Button
          className="actsix-btn-primary min-h-10"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save debrief"}
        </Button>
      </div>
    </section>
  );
}
