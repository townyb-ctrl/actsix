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

import { useVenueSpaces } from "./venuesQueries";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useVenueSpaces", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads spaces for the given workspace", async () => {
    const space = {
      id: "space-1",
      workspace_id: "workspace-1",
      user_id: "user-1",
      name: "Main Hall",
      description: "",
      capacity: null,
      hourly_rate: 0,
      daily_rate: 0,
      color: "",
      features: [],
      photo_urls: [],
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const builder = createQueryBuilder(okResult([space]));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(() => useVenueSpaces("workspace-1"), { wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_spaces");
    expect(result.current.spaces).toEqual([space]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces the error and returns an empty array when the query fails", async () => {
    const builder = createQueryBuilder(errorResult("permission denied"));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(() => useVenueSpaces("workspace-1"), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.spaces).toEqual([]);
    expect(result.current.error).toEqual({ message: "permission denied" });
  });

  it("does not query when there is no workspace id", () => {
    const { result } = renderHook(() => useVenueSpaces(undefined), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.spaces).toEqual([]);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
