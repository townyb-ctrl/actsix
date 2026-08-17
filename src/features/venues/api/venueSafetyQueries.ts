import { useQuery } from "@tanstack/react-query";

import { getHireContacts, getIncidents } from "@/features/venues/api/venueSafetyApi";
import type { VenueHireContact, VenueIncident } from "@/features/venues/lib/venueSafety";

export const incidentsKey = (hireId?: string | null) => ["venue-incidents", hireId] as const;
export const hireContactsKey = (hireId?: string | null) =>
  ["venue-hire-contacts", hireId] as const;

export function useIncidents(hireId?: string | null) {
  const query = useQuery({
    queryKey: incidentsKey(hireId),
    queryFn: async () => {
      const { data, error } = await getIncidents(hireId as string);
      if (error) throw error;
      return (data as VenueIncident[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    incidents: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export function useHireContacts(hireId?: string | null) {
  const query = useQuery({
    queryKey: hireContactsKey(hireId),
    queryFn: async () => {
      const { data, error } = await getHireContacts(hireId as string);
      if (error) throw error;
      return (data as VenueHireContact[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    contacts: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
