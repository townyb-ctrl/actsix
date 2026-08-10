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

import { useVenueBookings, useVenueRequestToken, useVenueSpaces } from "./venuesQueries";

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

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

describe("useVenueBookings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads bookings for the given workspace and date window", async () => {
    const booking = {
      id: "booking-1",
      workspace_id: "workspace-1",
      user_id: "user-1",
      space_id: "space-1",
      title: "Youth night",
      booking_type: "internal",
      hirer_contact_id: null,
      hirer_name: "",
      hirer_email: "",
      hirer_phone: "",
      starts_at: "2026-08-10T18:00:00.000Z",
      ends_at: "2026-08-10T20:00:00.000Z",
      status: "Confirmed",
      quoted_fee: 0,
      deposit_amount: 0,
      payment_status: "Not applicable",
      source: "staff",
      requested_features: [],
      needs_technician: false,
      technician_fee: 0,
      coffee_requested: false,
      coffee_fee: 0,
      notes: "",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const builder = createQueryBuilder(okResult([booking]));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(
      () => useVenueBookings({ workspaceId: "workspace-1", fromIso: "2026-08-01", toIso: "2026-08-31" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_bookings");
    expect(builder.gte).toHaveBeenCalledWith("starts_at", "2026-08-01");
    expect(builder.lte).toHaveBeenCalledWith("starts_at", "2026-08-31");
    expect(result.current.bookings).toEqual([booking]);
  });

  it("refetches when the date window changes", async () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    const { result, rerender } = renderHook(
      ({ fromIso }: { fromIso: string }) =>
        useVenueBookings({ workspaceId: "workspace-1", fromIso, toIso: "2026-08-31" }),
      { wrapper, initialProps: { fromIso: "2026-08-01" } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);

    rerender({ fromIso: "2026-09-01" });

    await waitFor(() => expect(supabaseMock.from).toHaveBeenCalledTimes(2));
  });
});

describe("useVenueRequestToken", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when no token has been issued", async () => {
    const builder = createQueryBuilder(okResult({ venue_request_token: null }));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(() => useVenueRequestToken("workspace-1"), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.requestToken).toBeNull();
  });

  it("returns the stored token", async () => {
    const builder = createQueryBuilder(okResult({ venue_request_token: "abc123" }));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(() => useVenueRequestToken("workspace-1"), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.requestToken).toBe("abc123");
  });
});
