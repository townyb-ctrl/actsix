import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  getVenueResources,
  getVenueSpaceResources,
  setSpaceResource,
  removeSpaceResource,
  setVenueResourceActive,
  upsertVenueResource,
} from "./venueResourcesApi";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getVenueResources", () => {
  it("filters to the workspace and orders by name", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueResources("workspace-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_resources");
    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(builder.order).toHaveBeenCalledWith("name", { ascending: true });
  });

  it("falls back to an impossible workspace rather than reading every row", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueResources(null);

    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "00000000-0000-0000-0000-000000000000");
  });
});

describe("upsertVenueResource", () => {
  it("inserts a new resource with the workspace and creator attached", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueResource({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { name: "Round tables", category: "Furniture", quantity: 12 },
    });

    expect(builder.insert).toHaveBeenCalledWith({
      name: "Round tables",
      category: "Furniture",
      quantity: 12,
      workspace_id: "workspace-1",
      user_id: "user-1",
    });
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("updates an existing resource without rewriting its workspace", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueResource({
      resourceId: "resource-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { name: "Trestle tables" },
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Trestle tables" })
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "resource-1");
    expect(builder.insert).not.toHaveBeenCalled();
  });
});

describe("setVenueResourceActive", () => {
  it("deactivates rather than deletes", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setVenueResourceActive("resource-1", false);

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "resource-1");
    expect(builder.delete).not.toHaveBeenCalled();
  });
});

describe("space resource links", () => {
  it("reads every link in the workspace", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueSpaceResources("workspace-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_space_resources");
    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
  });

  it("upserts a link on the space/resource pair so re-linking is not an error", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setSpaceResource({
      workspaceId: "workspace-1",
      spaceId: "space-1",
      resourceId: "resource-1",
      quantity: 40,
    });

    expect(builder.upsert).toHaveBeenCalledWith(
      {
        workspace_id: "workspace-1",
        space_id: "space-1",
        resource_id: "resource-1",
        quantity: 40,
      },
      { onConflict: "space_id,resource_id" }
    );
  });

  it("removes a link by its space/resource pair", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    removeSpaceResource({ spaceId: "space-1", resourceId: "resource-1" });

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("space_id", "space-1");
    expect(builder.eq).toHaveBeenCalledWith("resource_id", "resource-1");
  });
});
