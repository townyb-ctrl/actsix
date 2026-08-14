import { supabase } from "@/integrations/supabase/client";

import type { VenueQuoteLineKind, VenueQuoteStatus } from "@/features/venues/lib/venueQuotes";

export type VenueQuoteLinePayload = {
  kind?: VenueQuoteLineKind;
  description?: string;
  quantity?: number;
  unit_price?: number;
  sort_order?: number;
  notes?: string;
};

export const getQuoteLines = (hireId: string) =>
  (supabase as any)
    .from("venue_quote_lines")
    .select("*")
    .eq("hire_id", hireId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

export const upsertQuoteLine = ({
  lineId,
  workspaceId,
  hireId,
  userId,
  payload,
}: {
  lineId?: string;
  workspaceId: string;
  hireId: string;
  userId: string;
  payload: VenueQuoteLinePayload;
}) => {
  const table = (supabase as any).from("venue_quote_lines");

  if (lineId) {
    return table.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", lineId);
  }

  return table.insert({
    ...payload,
    workspace_id: workspaceId,
    hire_id: hireId,
    user_id: userId,
  });
};

export const deleteQuoteLine = (lineId: string) =>
  (supabase as any).from("venue_quote_lines").delete().eq("id", lineId);

/**
 * Marking a quote Sent stamps when, so "did we ever actually send this?" has an
 * answer. Nothing is emailed - the coordinator sends it themselves for now.
 */
export const setQuoteStatus = (hireId: string, status: VenueQuoteStatus) =>
  (supabase as any)
    .from("venue_hires")
    .update({
      quote_status: status,
      ...(status === "Sent" ? { quote_sent_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", hireId);

export const setPaymentTerms = (hireId: string, terms: string) =>
  (supabase as any)
    .from("venue_hires")
    .update({ payment_terms: terms, updated_at: new Date().toISOString() })
    .eq("id", hireId);
