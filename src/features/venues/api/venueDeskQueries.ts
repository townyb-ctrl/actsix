import { useQuery } from "@tanstack/react-query";

import {
  getAssignmentsForPositions,
  getWorkspaceHireContacts,
  getWorkspacePositions,
  getWorkspaceTurnaroundTasks,
} from "@/features/venues/api/venueDeskApi";
import type {
  VenuePosition,
  VenuePositionAssignment,
} from "@/features/venues/lib/venuePositions";
import type { VenueTurnaroundTask } from "@/features/venues/lib/venueTurnaround";
import type { VenueHireContact } from "@/features/venues/lib/venueSafety";

export const workspacePositionsKey = (workspaceId?: string | null) =>
  ["venue-workspace-positions", workspaceId] as const;

export const workspaceTurnaroundKey = (workspaceId?: string | null) =>
  ["venue-workspace-turnaround", workspaceId] as const;

export const workspaceHireContactsKey = (workspaceId?: string | null) =>
  ["venue-workspace-hire-contacts", workspaceId] as const;

/**
 * Every position in the workspace, with the people already on them.
 *
 * The two live in one hook because the second query cannot be written until the
 * first has returned its ids, and a desk that renders "nobody assigned" for a
 * beat while it waits would be telling a coordinator something untrue.
 */
export function useWorkspacePositions(workspaceId?: string | null) {
  const positionsQuery = useQuery({
    queryKey: workspacePositionsKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getWorkspacePositions(workspaceId);
      if (error) throw error;
      return (data as VenuePosition[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  const positions = positionsQuery.data ?? [];
  const ids = positions.map((position) => position.id);

  const assignmentsQuery = useQuery({
    queryKey: ["venue-workspace-assignments", [...ids].sort().join(",")] as const,
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await getAssignmentsForPositions(ids);
      if (error) throw error;
      return (data as VenuePositionAssignment[]) || [];
    },
    enabled: positionsQuery.isSuccess,
    retry: false,
  });

  return {
    positions,
    assignments: assignmentsQuery.data ?? [],
    loading:
      (positionsQuery.isPending && positionsQuery.fetchStatus !== "idle") ||
      (assignmentsQuery.isPending && assignmentsQuery.fetchStatus !== "idle"),
    error: (positionsQuery.error as { message: string } | null) ?? null,
  };
}

export function useWorkspaceTurnaroundTasks(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: workspaceTurnaroundKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getWorkspaceTurnaroundTasks(workspaceId);
      if (error) throw error;
      return (data as VenueTurnaroundTask[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    tasks: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export function useWorkspaceHireContacts(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: workspaceHireContactsKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getWorkspaceHireContacts(workspaceId);
      if (error) throw error;
      return (data as VenueHireContact[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    contacts: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
