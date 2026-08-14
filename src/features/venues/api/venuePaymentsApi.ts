import { supabase } from "@/integrations/supabase/client";

import type { VenuePaymentKind, VenuePaymentMethod } from "@/features/venues/lib/venuePayments";

export type VenuePaymentPayload = {
  kind?: VenuePaymentKind;
  amount?: number;
  paid_on?: string;
  method?: VenuePaymentMethod;
  reference?: string;
  notes?: string;
};

export const getPayments = (hireId: string) =>
  (supabase as any)
    .from("venue_payments")
    .select("*")
    .eq("hire_id", hireId)
    .order("paid_on", { ascending: false });

export const upsertPayment = ({
  paymentId,
  workspaceId,
  hireId,
  userId,
  payload,
}: {
  paymentId?: string;
  workspaceId: string;
  hireId: string;
  userId: string;
  payload: VenuePaymentPayload;
}) => {
  const table = (supabase as any).from("venue_payments");

  if (paymentId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", paymentId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    hire_id: hireId,
    user_id: userId,
  });
};

export const deletePayment = (paymentId: string) =>
  (supabase as any).from("venue_payments").delete().eq("id", paymentId);

/**
 * Records that the contract is signed. ACTSIX does not do e-signature - the
 * contract is printed, signed on paper, and who signed it recorded here.
 */
export const setContractSigned = ({
  hireId,
  signedOn,
  signedBy,
}: {
  hireId: string;
  signedOn: string | null;
  signedBy: string;
}) =>
  (supabase as any)
    .from("venue_hires")
    .update({
      contract_signed_on: signedOn,
      contract_signed_by: signedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", hireId);

export const setContractClauses = (hireId: string, clauses: string) =>
  (supabase as any)
    .from("venue_hires")
    .update({ contract_clauses: clauses, updated_at: new Date().toISOString() })
    .eq("id", hireId);

/** The church's standard clauses, written once and copied onto each hire. */
export const getWorkspaceContractClauses = (workspaceId: string) =>
  (supabase as any)
    .from("workspaces")
    .select("venue_contract_clauses")
    .eq("id", workspaceId)
    .maybeSingle();

export const setWorkspaceContractClauses = (workspaceId: string, clauses: string) =>
  (supabase as any)
    .from("workspaces")
    .update({ venue_contract_clauses: clauses })
    .eq("id", workspaceId)
    .select("id");
