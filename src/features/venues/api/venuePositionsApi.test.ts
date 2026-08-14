import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  assignPosition,
  getPositionAssignments,
  getPositionRoles,
  getPositions,
  upsertPosition,
} from "./venuePositionsApi";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getPositionRoles", () => {
  it("reads the workspace's roles in their set order", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getPositionRoles("workspace-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_position_roles");
    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(builder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
  });
});

describe("getPositions", () => {
  it("reads one hire's positions, earliest shift first", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getPositions("hire-1");

    expect(builder.eq).toHaveBeenCalledWith("hire_id", "hire-1");
    expect(builder.order).toHaveBeenCalledWith("starts_at", { ascending: true });
  });
});

describe("getPositionAssignments", () => {
  it("reads assignments for the given positions in one query", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getPositionAssignments(["p1", "p2"]);

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_position_assignments");
    expect(builder.in).toHaveBeenCalledWith("position_id", ["p1", "p2"]);
  });

  it("asks for an impossible id rather than every assignment when given none", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getPositionAssignments([]);

    expect(builder.in).toHaveBeenCalledWith("position_id", [
      "00000000-0000-0000-0000-000000000000",
    ]);
  });
});

describe("upsertPosition", () => {
  it("attaches a new position to its hire and workspace", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertPosition({
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { role_id: "role-1", needed: 2 },
    });

    expect(builder.insert).toHaveBeenCalledWith({
      role_id: "role-1",
      needed: 2,
      workspace_id: "workspace-1",
      hire_id: "hire-1",
      user_id: "user-1",
    });
  });

  it("updates a position without reassigning it to another hire", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertPosition({
      positionId: "position-1",
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { needed: 3 },
    });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ needed: 3 }));
    expect(update).not.toHaveProperty("hire_id");
  });
});

describe("assignPosition", () => {
  it("records a directory person by id", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    assignPosition({
      workspaceId: "workspace-1",
      positionId: "position-1",
      userId: "user-1",
      personId: "person-1",
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ person_id: "person-1", display_name: "" })
    );
  });

  it("records someone outside the directory by name, with no person id", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    assignPosition({
      workspaceId: "workspace-1",
      positionId: "position-1",
      userId: "user-1",
      displayName: "Andre",
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ person_id: null, display_name: "Andre" })
    );
  });
});
