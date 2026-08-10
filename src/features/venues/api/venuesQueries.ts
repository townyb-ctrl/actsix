import { useQuery } from "@tanstack/react-query";

import { getVenueBookings, getVenueRequestToken, getVenueSpaces } from "@/features/venues/api/venuesApi";
import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";

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

export const venueBookingsKey = (workspaceId?: string | null, fromIso?: string, toIso?: string) =>
  ["venue-bookings", workspaceId, fromIso, toIso] as const;

export function useVenueBookings({
  workspaceId,
  fromIso,
  toIso,
}: {
  workspaceId?: string | null;
  fromIso?: string;
  toIso?: string;
}) {
  const query = useQuery({
    queryKey: venueBookingsKey(workspaceId, fromIso, toIso),
    queryFn: async () => {
      const { data, error } = await getVenueBookings({ workspaceId, fromIso, toIso });
      if (error) throw error;
      return (data as VenueBooking[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    bookings: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const venueRequestTokenKey = (workspaceId?: string | null) => ["venue-request-token", workspaceId] as const;

export function useVenueRequestToken(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueRequestTokenKey(workspaceId),
    queryFn: async () => {
      const { data } = await getVenueRequestToken(workspaceId as string);
      return (data as { venue_request_token: string | null } | null)?.venue_request_token ?? null;
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    requestToken: query.data ?? null,
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}
