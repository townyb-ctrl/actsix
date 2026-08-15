import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  getTurnaroundTasks,
  setTurnaroundTaskDone,
  upsertTurnaroundTask,
  upsertWalkthrough,
} from "./venueTurnaroundApi";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getTurnaroundTasks", () => {
  it("reads one hire's tasks in their manual order", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getTurnaroundTasks("hire-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_turnaround_tasks");
    expect(builder.eq).toHaveBeenCalledWith("hire_id", "hire-1");
    expect(builder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
  });
});

describe("upsertTurnaroundTask", () => {
  it("stores an undated task with both ends null", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertTurnaroundTask({
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { title: "Restock the kitchen", starts_at: null, ends_at: null },
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ starts_at: null, ends_at: null, hire_id: "hire-1" })
    );
  });

  it("does not reassign a task to another hire when editing it", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertTurnaroundTask({
      taskId: "task-1",
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { title: "Mop" },
    });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).not.toHaveProperty("hire_id");
  });
});

describe("setTurnaroundTaskDone", () => {
  it("records who ticked it and when", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setTurnaroundTaskDone({ taskId: "task-1", done: true, doneBy: "dana@example.org" });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(
      expect.objectContaining({ done: true, done_by: "dana@example.org" })
    );
    expect(update.done_at).toEqual(expect.any(String));
  });

  it("clears the trace when un-ticked, so nobody is credited with work they did not do", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setTurnaroundTaskDone({ taskId: "task-1", done: false, doneBy: "dana@example.org" });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ done: false, done_at: null, done_by: "" })
    );
  });
});

describe("upsertWalkthrough", () => {
  it("attaches a new walkthrough to its hire and workspace", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertWalkthrough({
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { phase: "Before", space_id: null },
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_walkthroughs");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "Before", hire_id: "hire-1", workspace_id: "workspace-1" })
    );
  });

  it("replaces the photo list wholesale, which is how a photo is added or removed", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertWalkthrough({
      walkthroughId: "walk-1",
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { photo_urls: ["a.jpg", "b.jpg"] },
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ photo_urls: ["a.jpg", "b.jpg"] })
    );
  });
});
