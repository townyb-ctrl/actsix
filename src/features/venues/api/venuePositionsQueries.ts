import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

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

export const positionPeopleKey = (workspaceId?: string | null) =>
  ["venue-position-people", workspaceId] as const;

/**
 * The workspace directory, in the shape both the people picker and the board
 * label need. Read here rather than in the page so the two stay in step.
 */
export function usePositionPeople(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: positionPeopleKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("people")
        .select("id, display_name, avatar_url, email, phone_number")
        .eq("workspace_id", workspaceId)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data as {
        id: string;
        display_name: string;
        avatar_url: string | null;
        email: string | null;
        phone_number: string | null;
      }[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return { people: query.data ?? [] };
}
