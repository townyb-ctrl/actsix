import { useQuery } from "@tanstack/react-query";

import {
  getWorkspacePayments,
  getWorkspaceQuoteLines,
} from "@/features/venues/api/venueReportsApi";
import type { VenuePayment } from "@/features/venues/lib/venuePayments";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

export const workspaceQuoteLinesKey = (workspaceId?: string | null) =>
  ["venue-workspace-quote-lines", workspaceId] as const;

export const workspacePaymentsKey = (workspaceId?: string | null) =>
  ["venue-workspace-payments", workspaceId] as const;

export function useWorkspaceQuoteLines(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: workspaceQuoteLinesKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getWorkspaceQuoteLines(workspaceId);
      if (error) throw error;
      return (data as VenueQuoteLine[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    lines: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}

export function useWorkspacePayments(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: workspacePaymentsKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getWorkspacePayments(workspaceId);
      if (error) throw error;
      return (data as VenuePayment[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    payments: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}
