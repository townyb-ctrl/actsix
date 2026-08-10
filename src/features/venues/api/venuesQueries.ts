import { useQuery } from "@tanstack/react-query";

import { getVenueSpaces } from "@/features/venues/api/venuesApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";

export const venueSpacesKey = (workspaceId?: string | null) => ["venue-spaces", workspaceId] as const;

export function useVenueSpaces(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueSpacesKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getVenueSpaces(workspaceId);
      if (error) throw error;
      return (data as VenueSpace[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    spaces: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
    refetch: query.refetch,
  };
}
