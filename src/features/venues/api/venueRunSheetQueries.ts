import { useQuery } from "@tanstack/react-query";

import { getRunSheetItems } from "@/features/venues/api/venueRunSheetApi";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";

export const runSheetKey = (hireId?: string | null) => ["venue-run-sheet", hireId] as const;

export function useRunSheet(hireId?: string | null) {
  const query = useQuery({
    queryKey: runSheetKey(hireId),
    queryFn: async () => {
      const { data, error } = await getRunSheetItems(hireId as string);
      if (error) throw error;
      return (data as VenueRunSheetItem[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    items: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
