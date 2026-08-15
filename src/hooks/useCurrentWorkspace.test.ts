import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock, authMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn(), rpc: vi.fn() },
  authMock: { user: null as { id: string } | null },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authMock }));

import { useCurrentWorkspace } from "./useCurrentWorkspace";

const membershipRow = (overrides: Record<string, unknown> = {}) => ({
  id: "member-1",
  workspace_id: "workspace-1",
  auth_user_id: "user-1",
  person_id: "person-1",
  role: "admin",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const workspaceRow = (overrides: Record<string, unknown> = {}) => ({
  id: "workspace-1",
  name: "Test Workspace",
  slug: "test-workspace",
  join_code: "ABC123",
  owner_user_id: "user-1",
  release_mode: "alpha",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

/** The hook shares its result through React Query, so each test needs a fresh
 *  provider — otherwise one test's cache would answer the next test's render. */
const renderWorkspaceHook = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return renderHook(() => useCurrentWorkspace(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  });
};

describe("useCurrentWorkspace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.user = null;
  });

  it("clears workspace/membership and stops loading when there's no user", async () => {
    const { result } = renderWorkspaceHook();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspace).toBeNull();
    expect(result.current.membership).toBeNull();
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("loads the workspace and membership, deriving role flags", async () => {
    authMock.user = { id: "user-1" };
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "workspace_members")
        return createQueryBuilder(okResult(membershipRow({ role: "admin", workspaces: workspaceRow() })));
      throw new Error(`Unexpected table ${table}`);
    });

    const { result } = renderWorkspaceHook();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspace?.id).toBe("workspace-1");
    expect(result.current.role).toBe("admin");
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.canManageWorkspace).toBe(true);
    expect(result.current.canEditPeopleDirectory).toBe(true);
  });

  it("derives editor-level permissions correctly", async () => {
    authMock.user = { id: "user-1" };
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "workspace_members")
        return createQueryBuilder(okResult(membershipRow({ role: "editor", workspaces: workspaceRow() })));
      throw new Error(`Unexpected table ${table}`);
    });

    const { result } = renderWorkspaceHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isEditor).toBe(true);
    expect(result.current.canManageWorkspace).toBe(false);
    expect(result.current.canEditPeopleDirectory).toBe(true);
  });

  it("clears state when there's no active membership", async () => {
    authMock.user = { id: "user-1" };
    supabaseMock.from.mockReturnValue(createQueryBuilder(okResult(null)));

    const { result } = renderWorkspaceHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspace).toBeNull();
    expect(result.current.membership).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it("clears state and logs when the membership query errors", async () => {
    authMock.user = { id: "user-1" };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    supabaseMock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: "boom" } }));

    const { result } = renderWorkspaceHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspace).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it("calls the join RPC with the mapped params and reloads the workspace", async () => {
    authMock.user = { id: "user-1" };
    supabaseMock.from.mockReturnValue(createQueryBuilder(okResult(null)));
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const { result } = renderWorkspaceHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.joinWorkspace({ joinCode: "ABC123", joinPhrase: "open sesame" });
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith("join_workspace_by_code", {
      workspace_join_code: "ABC123",
      workspace_join_phrase: "open sesame",
    });
    // one initial load + one reload after joining
    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
  });

  it("returns an error from leaveWorkspace without calling the RPC when there's no workspace", async () => {
    authMock.user = { id: "user-1" };
    supabaseMock.from.mockReturnValue(createQueryBuilder(okResult(null)));

    const { result } = renderWorkspaceHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let response: { error: unknown };
    await act(async () => {
      response = await result.current.leaveWorkspace();
    });

    expect(response!.error).toBeInstanceOf(Error);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
