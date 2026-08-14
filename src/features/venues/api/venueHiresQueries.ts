import { useQuery } from "@tanstack/react-query";

import {
  getBookingsForHire,
  getVenueHire,
  getVenueHires,
} from "@/features/venues/api/venueHiresApi";
import type { VenueBooking } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";

export const venueHiresKey = (workspaceId?: string | null) => ["venue-hires", workspaceId] as const;

export function useVenueHires(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueHiresKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getVenueHires(workspaceId);
      if (error) throw error;
      return (data as VenueHire[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    hires: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const venueHireKey = (hireId?: string | null) => ["venue-hire", hireId] as const;

export function useVenueHire(hireId?: string | null) {
  const query = useQuery({
    queryKey: venueHireKey(hireId),
    queryFn: async () => {
      const { data, error } = await getVenueHire(hireId as string);
      if (error) throw error;
      return (data as VenueHire | null) ?? null;
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    hire: query.data ?? null,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const hireBookingsKey = (hireId?: string | null) => ["venue-hire-bookings", hireId] as const;

export function useHireBookings(hireId?: string | null) {
  const query = useQuery({
    queryKey: hireBookingsKey(hireId),
    queryFn: async () => {
      const { data, error } = await getBookingsForHire(hireId as string);
      if (error) throw error;
      return (data as VenueBooking[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    bookings: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
