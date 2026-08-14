import { supabase } from "@/integrations/supabase/client";

import { planClone, type CloneSource } from "@/features/venues/lib/venueClone";
import type { DebriefFields } from "@/features/venues/lib/venueDebrief";

export const saveHireDebrief = (hireId: string, fields: Partial<DebriefFields>) =>
  (supabase as any)
    .from("venue_hires")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", hireId);

export type CloneHireInput = {
  workspaceId: string;
  userId: string;
  name: string;
  startDay: string;
  /** The hire being repeated, for the fields worth carrying across. */
  hire: {
    event_type: string;
    hirer_contact_id: string | null;
    hirer_name: string;
    hirer_email: string;
    hirer_phone: string;
    onsite_contact_name: string;
    onsite_contact_phone: string;
    payment_terms: string;
    contract_clauses: string;
    lessons_learned: string;
    notes: string;
  };
  source: CloneSource;
};

/**
 * Create next year's hire from this one.
 *
 * Written as plain sequential inserts rather than one transaction because
 * PostgREST has no client-side transaction and the alternative is a database
 * function that duplicates every column list a second time. If a later insert
 * fails, the new hire exists with part of its detail and the error says so -
 * the hire is a draft nobody has sent, so a half-built one is a nuisance rather
 * than a correctness problem.
 *
 * ponytail: no transaction; move to a security-definer function if a partial
 * clone ever causes real trouble.
 */
export const cloneHire = async ({
  workspaceId,
  userId,
  name,
  startDay,
  hire,
  source,
}: CloneHireInput): Promise<{ hireId: string | null; error: { message: string } | null }> => {
  const plan = planClone(source, startDay);

  const { data, error } = await (supabase as any)
    .from("venue_hires")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      name,
      // A repeat starts as a draft with no quote sent and nothing signed,
      // whatever state the hire it came from ended in.
      status: "Draft",
      quote_status: "Draft",
      event_type: hire.event_type,
      hirer_contact_id: hire.hirer_contact_id,
      hirer_name: hire.hirer_name,
      hirer_email: hire.hirer_email,
      hirer_phone: hire.hirer_phone,
      onsite_contact_name: hire.onsite_contact_name,
      onsite_contact_phone: hire.onsite_contact_phone,
      payment_terms: hire.payment_terms,
      contract_clauses: hire.contract_clauses,
      // Carried forward on purpose: the point of writing a lesson down is that
      // the next run of the same event sees it.
      lessons_learned: hire.lessons_learned,
      notes: hire.notes,
    })
    .select("id")
    .single();

  if (error) return { hireId: null, error };

  const hireId = data.id as string;
  const owned = { workspace_id: workspaceId, hire_id: hireId, user_id: userId };

  const inserts: { table: string; rows: Record<string, unknown>[] }[] = [
    {
      table: "venue_bookings",
      rows: plan.bookings.map((booking) => ({ ...owned, ...booking, status: "Pending" })),
    },
    { table: "venue_quote_lines", rows: plan.lines.map((line) => ({ ...owned, ...line })) },
    {
      table: "venue_run_sheet_items",
      rows: plan.runSheetItems.map((item) => ({ ...owned, ...item })),
    },
    { table: "venue_positions", rows: plan.positions.map((position) => ({ ...owned, ...position })) },
  ];

  for (const { table, rows } of inserts) {
    if (rows.length === 0) continue;
    const result = await (supabase as any).from(table).insert(rows);
    if (result.error) return { hireId, error: result.error };
  }

  return { hireId, error: null };
};
