import { useQuery } from "@tanstack/react-query";

import { getQuoteLines } from "@/features/venues/api/venueQuotesApi";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";

export const quoteLinesKey = (hireId?: string | null) => ["venue-quote-lines", hireId] as const;

export function useQuoteLines(hireId?: string | null) {
  const query = useQuery({
    queryKey: quoteLinesKey(hireId),
    queryFn: async () => {
      const { data, error } = await getQuoteLines(hireId as string);
      if (error) throw error;
      return (data as VenueQuoteLine[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    lines: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
