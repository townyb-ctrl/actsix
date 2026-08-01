import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { syncProjectStatsById, syncProjectStatsForIds, syncProjectStatsForNames } from "./syncProjectStats";

describe("syncProjectStatsById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when no projectId is given", async () => {
    await syncProjectStatsById(undefined);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("does nothing when the project can't be found", async () => {
    supabaseMock.from.mockReturnValueOnce(createQueryBuilder(okResult([])));

    await syncProjectStatsById("missing-project");

    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it("computes open task count, progress, and next action, then updates the project", async () => {
    const selectProjectBuilder = createQueryBuilder(okResult([{ id: "project-1", name: "Project" }]));
    const selectTasksBuilder = createQueryBuilder(
      okResult([
        { title: "Task A", complete: false, created_at: "2026-01-02" },
        { title: "Task B", complete: true, created_at: "2026-01-01" },
      ])
    );
    const updateBuilder = createQueryBuilder(okResult(null));

    supabaseMock.from
      .mockReturnValueOnce(selectProjectBuilder)
      .mockReturnValueOnce(selectTasksBuilder)
      .mockReturnValueOnce(updateBuilder);

    await syncProjectStatsById("project-1");

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        open_tasks: 1,
        progress: 50,
        next_action: "Task A",
      })
    );
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "project-1");
  });

  it("reports 0 progress and no next action when there are no tasks", async () => {
    const selectProjectBuilder = createQueryBuilder(okResult([{ id: "project-1", name: "Project" }]));
    const selectTasksBuilder = createQueryBuilder(okResult([]));
    const updateBuilder = createQueryBuilder(okResult(null));

    supabaseMock.from
      .mockReturnValueOnce(selectProjectBuilder)
      .mockReturnValueOnce(selectTasksBuilder)
      .mockReturnValueOnce(updateBuilder);

    await syncProjectStatsById("project-1");

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ open_tasks: 0, progress: 0, next_action: "" })
    );
  });
});

describe("syncProjectStatsForIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dedupes ids before syncing", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "projects") return createQueryBuilder(okResult([]));
      return createQueryBuilder(okResult([]));
    });

    await syncProjectStatsForIds(["project-1", "project-1", undefined, null]);

    // one lookup per unique, truthy id
    const projectLookupCalls = supabaseMock.from.mock.calls.filter(([table]) => table === "projects");
    expect(projectLookupCalls).toHaveLength(1);
  });
});

describe("syncProjectStatsForNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dedupes names before syncing", async () => {
    supabaseMock.from.mockImplementation(() => createQueryBuilder(okResult([])));

    await syncProjectStatsForNames(["Project A", "Project A", "  ", undefined], "user-1");

    const projectLookupCalls = supabaseMock.from.mock.calls.filter(([table]) => table === "projects");
    expect(projectLookupCalls).toHaveLength(1);
  });
});
