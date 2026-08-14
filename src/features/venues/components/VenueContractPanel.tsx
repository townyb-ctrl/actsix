import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setContractClauses, setContractSigned } from "@/features/venues/api/venuePaymentsApi";
import type { VenueHire } from "@/features/venues/lib/venueHires";

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
  const [clauses, setClauses] = useState("");
  const [signedOn, setSignedOn] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [savingClauses, setSavingClauses] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  useEffect(() => {
    // An untouched hire inherits the standard wording, so the coordinator edits
    // a real contract rather than a blank box.
    setClauses(hire.contract_clauses || workspaceClauses);
    setSignedOn(hire.contract_signed_on || "");
    setSignedBy(hire.contract_signed_by || "");
  }, [hire, workspaceClauses]);

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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Contract</CardTitle>
          {hire.contract_signed_on ? (
            <Badge variant="default">Signed</Badge>
          ) : (
            <Badge variant="secondary">Unsigned</Badge>
          )}
        </div>

        <Button size="sm" variant="outline" onClick={onPrint}>
          <Printer className="h-4 w-4" />
          Print agreement
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
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

        <div className="space-y-3 border-t pt-4">
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
      </CardContent>
    </Card>
  );
}
