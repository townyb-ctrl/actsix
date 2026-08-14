import { useQuery } from "@tanstack/react-query";

import {
  getPositionAssignments,
  getPositionRoles,
  getPositions,
} from "@/features/venues/api/venuePositionsApi";
import type {
  VenuePosition,
  VenuePositionAssignment,
  VenuePositionRole,
} from "@/features/venues/lib/venuePositions";

export const positionRolesKey = (workspaceId?: string | null) =>
  ["venue-position-roles", workspaceId] as const;

export function usePositionRoles(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: positionRolesKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getPositionRoles(workspaceId);
      if (error) throw error;
      return (data as VenuePositionRole[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    roles: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const positionsKey = (hireId?: string | null) => ["venue-positions", hireId] as const;

export function usePositions(hireId?: string | null) {
  const query = useQuery({
    queryKey: positionsKey(hireId),
    queryFn: async () => {
      const { data, error } = await getPositions(hireId as string);
      if (error) throw error;
      return (data as VenuePosition[]) || [];
    },
    enabled: Boolean(hireId),
    retry: false,
  });

  return {
    positions: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const positionAssignmentsKey = (positionIds: string[]) =>
  ["venue-position-assignments", [...positionIds].sort().join(",")] as const;

/**
 * Assignments for a hire's positions. Keyed on the position ids so adding a
 * position refetches, rather than showing an empty board for the new slot.
 */
export function usePositionAssignments(positionIds: string[]) {
  const query = useQuery({
    queryKey: positionAssignmentsKey(positionIds),
    queryFn: async () => {
      const { data, error } = await getPositionAssignments(positionIds);
      if (error) throw error;
      return (data as VenuePositionAssignment[]) || [];
    },
    enabled: positionIds.length > 0,
    retry: false,
  });

  return {
    assignments: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}
