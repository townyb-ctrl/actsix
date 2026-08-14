import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { getRunSheetItems, setHireLessons, upsertRunSheetItem } from "./venueRunSheetApi";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getRunSheetItems", () => {
  it("reads one hire's items in running order", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getRunSheetItems("hire-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_run_sheet_items");
    expect(builder.eq).toHaveBeenCalledWith("hire_id", "hire-1");
    expect(builder.order).toHaveBeenCalledWith("starts_at", { ascending: true });
    expect(builder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
  });
});

describe("upsertRunSheetItem", () => {
  it("attaches a new item to its hire and workspace", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertRunSheetItem({
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: {
        title: "Registration",
        space_id: "space-1",
        starts_at: "2026-09-10T08:00:00.000Z",
        ends_at: "2026-09-10T09:00:00.000Z",
      },
    });

    expect(builder.insert).toHaveBeenCalledWith({
      title: "Registration",
      space_id: "space-1",
      starts_at: "2026-09-10T08:00:00.000Z",
      ends_at: "2026-09-10T09:00:00.000Z",
      workspace_id: "workspace-1",
      hire_id: "hire-1",
      user_id: "user-1",
    });
  });

  it("stores a whole-venue item with no space rather than skipping the field", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertRunSheetItem({
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { title: "Site safety briefing", space_id: null },
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ space_id: null }));
  });

  it("updates an item without reassigning it to another hire", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertRunSheetItem({
      itemId: "item-1",
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { title: "Renamed" },
    });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ title: "Renamed" }));
    expect(update).not.toHaveProperty("hire_id");
    expect(builder.eq).toHaveBeenCalledWith("id", "item-1");
  });
});

describe("setHireLessons", () => {
  it("saves what to do differently onto the hire", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setHireLessons("hire-1", "Next year, be here Friday night.");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_hires");
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ lessons_learned: "Next year, be here Friday night." })
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "hire-1");
  });
});
