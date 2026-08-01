import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { isSoftwareDeveloper } from "./developerAccess";
import type { Workspace } from "@/hooks/useCurrentWorkspace";

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: "user-1",
    email: "someone@example.com",
    ...overrides,
  }) as User;

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace =>
  ({
    id: "workspace-1",
    name: "Test Workspace",
    slug: "test-workspace",
    join_code: "ABC123",
    owner_user_id: "owner-1",
    release_mode: "alpha",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as Workspace;

describe("isSoftwareDeveloper", () => {
  it("returns false when there is no user", () => {
    expect(isSoftwareDeveloper({ user: null })).toBe(false);
  });

  it("returns true when the user owns the workspace", () => {
    const user = makeUser({ id: "owner-1" });
    expect(isSoftwareDeveloper({ user, workspace: makeWorkspace({ owner_user_id: "owner-1" }) })).toBe(
      true
    );
  });

  it("returns false when the user does not own the workspace and isn't a listed developer", () => {
    const user = makeUser({ id: "someone-else" });
    expect(isSoftwareDeveloper({ user, workspace: makeWorkspace({ owner_user_id: "owner-1" }) })).toBe(
      false
    );
  });

  it("returns false when there is no workspace and the email isn't a listed developer", () => {
    const user = makeUser();
    expect(isSoftwareDeveloper({ user, workspace: null })).toBe(false);
  });
});
