import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock, authMock, toastMock } = vi.hoisted(() => ({
  supabaseMock: { rpc: vi.fn() },
  authMock: { user: null as { id: string; email?: string } | null },
  toastMock: { error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { useCurrentPerson } from "./useCurrentPerson";

describe("useCurrentPerson", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.user = null;
  });

  it("clears person and stops loading when there's no user", async () => {
    const { result } = renderHook(() => useCurrentPerson());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.person).toBeNull();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("falls back to a title-cased name derived from the email when there's no person yet", async () => {
    authMock.user = { id: "user-1", email: "jane.doe@example.com" };
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useCurrentPerson());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.displayName).toBe("Jane Doe");
  });

  it("loads the current person via RPC and prefers their stored display name", async () => {
    authMock.user = { id: "user-1", email: "jane.doe@example.com" };
    supabaseMock.rpc.mockResolvedValue({
      data: { id: "person-1", display_name: "Jane" },
      error: null,
    });

    const { result } = renderHook(() => useCurrentPerson());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(supabaseMock.rpc).toHaveBeenCalledWith("ensure_current_workspace_person");
    expect(result.current.person?.id).toBe("person-1");
    expect(result.current.displayName).toBe("Jane");
  });

  it("shows a toast and clears the person when the RPC errors", async () => {
    authMock.user = { id: "user-1", email: "jane.doe@example.com" };
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const { result } = renderHook(() => useCurrentPerson());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.person).toBeNull();
    expect(toastMock.error).toHaveBeenCalledWith("boom");
  });
});
