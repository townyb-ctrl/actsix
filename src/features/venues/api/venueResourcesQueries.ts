import { useQuery } from "@tanstack/react-query";

import { getVenueResources, getVenueSpaceResources } from "@/features/venues/api/venueResourcesApi";
import type { VenueResource, VenueSpaceResource } from "@/features/venues/lib/venueResources";

export const venueResourcesKey = (workspaceId?: string | null) =>
  ["venue-resources", workspaceId] as const;

export function useVenueResources(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueResourcesKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getVenueResources(workspaceId);
      if (error) throw error;
      return (data as VenueResource[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    resources: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const venueSpaceResourcesKey = (workspaceId?: string | null) =>
  ["venue-space-resources", workspaceId] as const;

/**
 * Every space-to-resource link in the workspace, filtered per space in the UI.
 * A church has tens of spaces and hundreds of links at most, so one query beats
 * a query per space.
 */
export function useVenueSpaceResources(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueSpaceResourcesKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getVenueSpaceResources(workspaceId);
      if (error) throw error;
      return (data as VenueSpaceResource[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    spaceResources: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
