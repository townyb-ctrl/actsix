import { useQuery } from "@tanstack/react-query";

import { getChurchEventsInRange } from "@/features/venues/api/venueClashesApi";
import type { ChurchEvent } from "@/features/venues/lib/venueClashes";

export const churchEventsKey = (
  workspaceId?: string | null,
  startsAt?: string | null,
  endsAt?: string | null
) => ["venue-church-events", workspaceId, startsAt, endsAt] as const;

export function useChurchEvents({
  workspaceId,
  startsAt,
  endsAt,
}: {
  workspaceId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const query = useQuery({
    queryKey: churchEventsKey(workspaceId, startsAt, endsAt),
    queryFn: async () => {
      const { data, error } = await getChurchEventsInRange({
        workspaceId: workspaceId as string,
        startsAt: startsAt as string,
        endsAt: endsAt as string,
      });
      // A workspace that has never opened Calendar has no table yet. That is
      // not an error worth shouting about - it just means nothing to clash with.
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data as ChurchEvent[]) || [];
    },
    enabled: Boolean(workspaceId && startsAt && endsAt),
    retry: false,
  });

  return {
    events: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
