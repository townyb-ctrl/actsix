import { useQuery } from "@tanstack/react-query";

import {
  getAvPresets,
  getHireSigns,
  getResourceCheckouts,
  getVenueSigns,
} from "@/features/venues/api/venueSignageApi";
import type {
  VenueAvPreset,
  VenueHireSign,
  VenueResourceCheckout,
  VenueSign,
} from "@/features/venues/lib/venueSignage";

export const signsKey = (workspaceId?: string | null) => ["venue-signs", workspaceId] as const;
export const hireSignsKey = (hireId?: string | null) => ["venue-hire-signs", hireId] as const;
export const avPresetsKey = (workspaceId?: string | null) =>
  ["venue-av-presets", workspaceId] as const;
export const checkoutsKey = (hireId?: string | null) => ["venue-checkouts", hireId] as const;

export function useVenueSigns(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: signsKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getVenueSigns(workspaceId);
      if (error) throw error;
      return (data as VenueSign[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return { signs: query.data ?? [], loading: query.isPending && query.fetchStatus !== "idle" };
}

export function useHireSigns(hireId?: string | null) {
  const query = useQuery({
    queryKey: hireSignsKey(hireId),
    queryFn: async () => {
      const { data, error } = await getHireSigns(hireId as string);
      if (error) throw error;
      return (data as VenueHireSign[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return { links: query.data ?? [] };
}

export function useAvPresets(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: avPresetsKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getAvPresets(workspaceId);
      if (error) throw error;
      return (data as VenueAvPreset[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return { presets: query.data ?? [], loading: query.isPending && query.fetchStatus !== "idle" };
}

export function useResourceCheckouts(hireId?: string | null) {
  const query = useQuery({
    queryKey: checkoutsKey(hireId),
    queryFn: async () => {
      const { data, error } = await getResourceCheckouts(hireId as string);
      if (error) throw error;
      return (data as VenueResourceCheckout[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return { checkouts: query.data ?? [] };
}
