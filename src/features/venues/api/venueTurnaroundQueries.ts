import { useQuery } from "@tanstack/react-query";

import {
  getTurnaroundTasks,
  getWalkthroughs,
} from "@/features/venues/api/venueTurnaroundApi";
import type {
  VenueTurnaroundTask,
  VenueWalkthrough,
} from "@/features/venues/lib/venueTurnaround";

export const turnaroundKey = (hireId?: string | null) => ["venue-turnaround", hireId] as const;
export const walkthroughsKey = (hireId?: string | null) =>
  ["venue-walkthroughs", hireId] as const;

export function useTurnaroundTasks(hireId?: string | null) {
  const query = useQuery({
    queryKey: turnaroundKey(hireId),
    queryFn: async () => {
      const { data, error } = await getTurnaroundTasks(hireId as string);
      if (error) throw error;
      return (data as VenueTurnaroundTask[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    tasks: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export function useWalkthroughs(hireId?: string | null) {
  const query = useQuery({
    queryKey: walkthroughsKey(hireId),
    queryFn: async () => {
      const { data, error } = await getWalkthroughs(hireId as string);
      if (error) throw error;
      return (data as VenueWalkthrough[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    walkthroughs: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
