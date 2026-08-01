import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, errorResult, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { logActivity } from "./activityLog";

describe("logActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts an activity log row and returns the created record", async () => {
    const created = {
      id: "log-1",
      actor_person_id: "person-1",
      entity_type: "project",
      entity_id: "project-1",
      action_type: "created",
      title: "Created project",
      description: null,
      metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    };
    supabaseMock.from.mockReturnValue(createQueryBuilder(okResult(created)));

    const result = await logActivity({
      userId: "user-1",
      entityType: "project",
      entityId: "project-1",
      actionType: "created",
      title: "Created project",
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("activity_logs");
    expect(result).toEqual({ data: created, error: null });
  });

  it("returns the error and logs it when the insert fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    supabaseMock.from.mockReturnValue(createQueryBuilder(errorResult("insert failed")));

    const result = await logActivity({
      userId: "user-1",
      entityType: "task",
      entityId: "task-1",
      actionType: "updated",
      title: "Updated task",
    });

    expect(result).toEqual({ data: null, error: { message: "insert failed" } });
    expect(consoleError).toHaveBeenCalled();
  });
});
