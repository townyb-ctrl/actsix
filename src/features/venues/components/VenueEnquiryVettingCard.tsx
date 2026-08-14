import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, fieldControlClass } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateVenueEnquiryVetting } from "@/features/venues/api/venueEnquiriesApi";
import {
  VENUE_RISK_LEVELS,
  vettingProgress,
  type VenueEnquiry,
  type VenueRiskLevel,
} from "@/features/venues/lib/venueEnquiries";

type Props = {
  enquiry: VenueEnquiry;
  onSaved: () => void;
};

type YesNo = "" | "yes" | "no";

const toYesNo = (value: boolean | null): YesNo => {
  if (value === null) return "";
  return value ? "yes" : "no";
};

const fromYesNo = (value: YesNo): boolean | null => {
  if (value === "") return null;
  return value === "yes";
};

const CHECKS: {
  key: "vetting_values_aligned" | "vetting_has_restricted_content" | "vetting_can_deliver";
  label: string;
  hint: string;
}[] = [
  {
    key: "vetting_values_aligned",
    label: "Fits our hire policy and values",
    hint: "Would we be comfortable having our name on this?",
  },
  {
    key: "vetting_has_restricted_content",
    label: "Involves restricted content",
    hint: "Alcohol, gambling, adult themes, or another group's religious service.",
  },
  {
    key: "vetting_can_deliver",
    label: "The hirer can actually deliver it",
    hint: "Past hires, references, or a track record we know.",
  },
];

const RISKS: { key: "vetting_damage_risk" | "vetting_reputational_risk"; label: string }[] = [
  { key: "vetting_damage_risk", label: "Cleaning / damage risk" },
  { key: "vetting_reputational_risk", label: "Reputational risk" },
];

export default function VenueEnquiryVettingCard({ enquiry, onSaved }: Props) {
  const [valuesAligned, setValuesAligned] = useState<YesNo>("");
  const [restrictedContent, setRestrictedContent] = useState<YesNo>("");
  const [canDeliver, setCanDeliver] = useState<YesNo>("");
  const [damageRisk, setDamageRisk] = useState<VenueRiskLevel>("");
  const [reputationalRisk, setReputationalRisk] = useState<VenueRiskLevel>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValuesAligned(toYesNo(enquiry.vetting_values_aligned));
    setRestrictedContent(toYesNo(enquiry.vetting_has_restricted_content));
    setCanDeliver(toYesNo(enquiry.vetting_can_deliver));
    setDamageRisk(enquiry.vetting_damage_risk);
    setReputationalRisk(enquiry.vetting_reputational_risk);
    setNotes(enquiry.vetting_notes);
  }, [enquiry]);

  const values: Record<string, YesNo> = {
    vetting_values_aligned: valuesAligned,
    vetting_has_restricted_content: restrictedContent,
    vetting_can_deliver: canDeliver,
  };

  const setters: Record<string, (next: YesNo) => void> = {
    vetting_values_aligned: setValuesAligned,
    vetting_has_restricted_content: setRestrictedContent,
    vetting_can_deliver: setCanDeliver,
  };

  const riskValues: Record<string, VenueRiskLevel> = {
    vetting_damage_risk: damageRisk,
    vetting_reputational_risk: reputationalRisk,
  };

  const riskSetters: Record<string, (next: VenueRiskLevel) => void> = {
    vetting_damage_risk: setDamageRisk,
    vetting_reputational_risk: setReputationalRisk,
  };

  const progress = vettingProgress({
    ...enquiry,
    vetting_values_aligned: fromYesNo(valuesAligned),
    vetting_has_restricted_content: fromYesNo(restrictedContent),
    vetting_can_deliver: fromYesNo(canDeliver),
    vetting_damage_risk: damageRisk,
    vetting_reputational_risk: reputationalRisk,
  });

  const save = async () => {
    setSaving(true);
    const { error } = await updateVenueEnquiryVetting(enquiry.id, {
      vetting_values_aligned: fromYesNo(valuesAligned),
      vetting_has_restricted_content: fromYesNo(restrictedContent),
      vetting_can_deliver: fromYesNo(canDeliver),
      vetting_damage_risk: damageRisk,
      vetting_reputational_risk: reputationalRisk,
      vetting_notes: notes.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the vetting", { description: error.message });
      return;
    }

    toast.success("Vetting saved");
    onSaved();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Vetting</CardTitle>
        <Badge variant={progress.isComplete ? "default" : "secondary"}>
          {progress.completed} of {progress.total}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {CHECKS.map((check) => (
          <Field key={check.key} label={check.label} htmlFor={check.key}>
            <select
              id={check.key}
              value={values[check.key]}
              onChange={(event) => setters[check.key](event.target.value as YesNo)}
              className={cn(fieldControlClass)}
            >
              <option value="">Not assessed</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            <p className="text-xs text-muted-foreground">{check.hint}</p>
          </Field>
        ))}

        {RISKS.map((risk) => (
          <Field key={risk.key} label={risk.label} htmlFor={risk.key}>
            <select
              id={risk.key}
              value={riskValues[risk.key]}
              onChange={(event) => riskSetters[risk.key](event.target.value as VenueRiskLevel)}
              className={cn(fieldControlClass)}
            >
              <option value="">Not assessed</option>
              {VENUE_RISK_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </Field>
        ))}

        <Field label="Notes" htmlFor="vetting-notes">
          <textarea
            id="vetting-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className={cn(fieldControlClass, "min-h-20 py-2")}
          />
        </Field>

        <Button onClick={save} disabled={saving} className="actsix-btn-primary">
          {saving ? "Saving…" : "Save vetting"}
        </Button>
      </CardContent>
    </Card>
  );
}
