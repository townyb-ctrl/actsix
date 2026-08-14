import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { createQueryBuilder, errorResult, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { useVenueResources, useVenueSpaceResources } from "./venueResourcesQueries";

let queryClient: QueryClient;

beforeEach(() => {
  vi.resetAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe("useVenueResources", () => {
  it("loads resources for the given workspace", async () => {
    const resource = {
      id: "resource-1",
      workspace_id: "workspace-1",
      user_id: "user-1",
      name: "Round tables",
      category: "Furniture",
      quantity: 12,
      unit: "",
      is_included: true,
      unit_price: 0,
      notes: "",
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    supabaseMock.from.mockReturnValue(createQueryBuilder(okResult([resource])));

    const { result } = renderHook(() => useVenueResources("workspace-1"), { wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_resources");
    expect(result.current.resources).toEqual([resource]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces the error and returns an empty array when the query fails", async () => {
    supabaseMock.from.mockReturnValue(createQueryBuilder(errorResult("permission denied")));

    const { result } = renderHook(() => useVenueResources("workspace-1"), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.resources).toEqual([]);
    expect(result.current.error).toEqual({ message: "permission denied" });
  });

  it("does not query when there is no workspace id", () => {
    const { result } = renderHook(() => useVenueResources(null), { wrapper });

    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});

describe("useVenueSpaceResources", () => {
  it("loads every space-resource link in the workspace", async () => {
    const spaceResource = {
      id: "link-1",
      workspace_id: "workspace-1",
      space_id: "space-1",
      resource_id: "resource-1",
      quantity: 40,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    supabaseMock.from.mockReturnValue(createQueryBuilder(okResult([spaceResource])));

    const { result } = renderHook(() => useVenueSpaceResources("workspace-1"), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_space_resources");
    expect(result.current.spaceResources).toEqual([spaceResource]);
  });
});
