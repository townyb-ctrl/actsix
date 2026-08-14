import { useQuery } from "@tanstack/react-query";

import {
  getPayments,
  getWorkspaceContractClauses,
} from "@/features/venues/api/venuePaymentsApi";
import type { VenuePayment } from "@/features/venues/lib/venuePayments";

export const paymentsKey = (hireId?: string | null) => ["venue-payments", hireId] as const;

export function usePayments(hireId?: string | null) {
  const query = useQuery({
    queryKey: paymentsKey(hireId),
    queryFn: async () => {
      const { data, error } = await getPayments(hireId as string);
      if (error) throw error;
      return (data as VenuePayment[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    payments: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const workspaceClausesKey = (workspaceId?: string | null) =>
  ["venue-contract-clauses", workspaceId] as const;

export function useWorkspaceContractClauses(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: workspaceClausesKey(workspaceId),
    queryFn: async () => {
      const { data } = await getWorkspaceContractClauses(workspaceId as string);
      return (data as { venue_contract_clauses: string } | null)?.venue_contract_clauses ?? "";
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return { clauses: query.data ?? "" };
}
