import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setContractClauses, setContractSigned } from "@/features/venues/api/venuePaymentsApi";
import VenuePanelSection from "@/features/venues/components/VenuePanelSection";
import type { VenueHire } from "@/features/venues/lib/venueHires";

const formatSigned = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

type Props = {
  hire: VenueHire;
  /** The church's standard wording, used when this hire has none of its own yet. */
  workspaceClauses: string;
  onPrint: () => void;
  onSaved: () => void;
};

export default function VenueContractPanel({
  hire,
  workspaceClauses,
  onPrint,
  onSaved,
}: Props) {
  // Seeded at first render, not in the effect below: a first pass holding "" is
  // a difference from the hire, and the lid would read as unsaved typing before
  // anybody had typed.
  const [clauses, setClauses] = useState(hire.contract_clauses || workspaceClauses);
  const [signedOn, setSignedOn] = useState(hire.contract_signed_on || "");
  const [signedBy, setSignedBy] = useState(hire.contract_signed_by || "");
  const [savingClauses, setSavingClauses] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  useEffect(() => {
    // An untouched hire inherits the standard wording, so the coordinator edits
    // a real contract rather than a blank box.
    setClauses(hire.contract_clauses || workspaceClauses);
    setSignedOn(hire.contract_signed_on || "");
    setSignedBy(hire.contract_signed_by || "");
  }, [hire, workspaceClauses]);

  // Only so the fold's lid can admit there is typing inside it. Nothing
  // unmounts this panel any more, so nothing can discard the typing either.
  const dirty =
    clauses !== (hire.contract_clauses || workspaceClauses) ||
    signedOn !== (hire.contract_signed_on || "") ||
    signedBy !== (hire.contract_signed_by || "");

  const saveClauses = async () => {
    setSavingClauses(true);
    const { error } = await setContractClauses(hire.id, clauses);
    setSavingClauses(false);

    if (error) {
      toast.error("Could not save the contract wording", { description: error.message });
      return;
    }
    toast.success("Contract wording saved");
    onSaved();
  };

  const saveSignature = async () => {
    setSavingSignature(true);
    const { error } = await setContractSigned({
      hireId: hire.id,
      signedOn: signedOn || null,
      signedBy: signedBy.trim(),
    });
    setSavingSignature(false);

    if (error) {
      toast.error("Could not record the signature", { description: error.message });
      return;
    }
    onSaved();
  };

  return (
    <section className="st-panel" aria-labelledby="contract-heading">
      <div className="st-panel-head">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="st-panel-title" id="contract-heading">
            Contract
          </h2>
          {hire.contract_signed_on ? (
            <Badge variant="default">Signed</Badge>
          ) : (
            <Badge variant="secondary">Unsigned</Badge>
          )}
        </div>

        <Button size="sm" variant="ghost" className="min-h-9" onClick={onPrint}>
          <Printer className="h-4 w-4" />
          Print agreement
        </Button>
      </div>

      <VenuePanelSection
        title="Wording"
        hint={
          dirty && clauses !== (hire.contract_clauses || workspaceClauses)
            ? "Unsaved"
            : hire.contract_clauses
              ? "Edited for this hire"
              : "Your standard wording"
        }
      >
        <div className="space-y-3 px-4 py-4">
          <Field label="Terms and conditions for this hire" htmlFor="venue-contract-clauses">
            <textarea
              id="venue-contract-clauses"
              value={clauses}
              onChange={(event) => setClauses(event.target.value)}
              rows={6}
              placeholder="No food in the auditorium. Upstairs is closed to guests. Damage is charged against the bond."
              className={cn(fieldControlClass, "min-h-32 py-2")}
            />
            <p className="text-xs text-muted-foreground">
              Starts from your standard wording, set under Spaces. Editing here changes this hire
              only.
            </p>
          </Field>

          <Button size="sm" variant="outline" onClick={saveClauses} disabled={savingClauses}>
            {savingClauses ? "Saving…" : "Save wording"}
          </Button>
        </div>
      </VenuePanelSection>

      <VenuePanelSection
        title="Signature"
        hint={
          hire.contract_signed_on
            ? `${formatSigned(hire.contract_signed_on)}${
                hire.contract_signed_by ? ` · ${hire.contract_signed_by}` : ""
              }`
            : "Not recorded"
        }
      >
        <div className="space-y-3 px-4 py-4">
          <FieldRow>
            <Field label="Signed on" htmlFor="venue-contract-signed-on">
              <input
                id="venue-contract-signed-on"
                type="date"
                value={signedOn}
                onChange={(event) => setSignedOn(event.target.value)}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Signed by" htmlFor="venue-contract-signed-by">
              <input
                id="venue-contract-signed-by"
                value={signedBy}
                onChange={(event) => setSignedBy(event.target.value)}
                placeholder="Dana Robertson"
                className={cn(fieldControlClass)}
              />
            </Field>
          </FieldRow>

          <Button size="sm" variant="outline" onClick={saveSignature} disabled={savingSignature}>
            {savingSignature ? "Saving…" : "Record signature"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Printed, signed on paper, recorded here. ACTSIX does not do e-signature.
          </p>
        </div>
      </VenuePanelSection>
    </section>
  );
}
