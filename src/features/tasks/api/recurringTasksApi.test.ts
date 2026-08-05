import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";
import type { RecurringTaskTemplate } from "@/features/tasks/types/recurringTasks";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { createNextRecurringTaskOnCompletion, createTaskInstanceFromTemplate } from "./recurringTasksApi";

const baseTemplate: RecurringTaskTemplate = {
  id: "template-1",
  user_id: "user-1",
  title: "Water the plants",
  description: "Keep them alive",
  project: "Chores",
  project_id: null,
  assigned_person_id: null,
  priority: "Medium",
  context: "General",
  energy: "Medium",
  minutes: 15,
  tags: [],
  first_due_date: "2026-01-01",
  next_due_date: "2026-01-08",
  frequency: "weekly",
  interval: 1,
  end_condition: "never",
  end_date: null,
  end_after_occurrences: null,
  creation_mode: "on_completion",
  status: "active",
  generated_count: 2,
  last_generated_task_id: "old-task-id",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("createTaskInstanceFromTemplate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("inserts a task and advances the template's generated_count/next_due_date", async () => {
    const insertBuilder = createQueryBuilder(okResult({ id: "new-task-id" }));
    const updateBuilder = createQueryBuilder(okResult(null));

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "tasks") return insertBuilder;
      if (table === "recurring_task_templates") return updateBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await createTaskInstanceFromTemplate(baseTemplate, "2026-01-08");

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Water the plants",
        due: "2026-01-08",
        recurring_template_id: "template-1",
        recurring_occurrence_number: 3,
      })
    );
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        generated_count: 3,
        last_generated_task_id: "new-task-id",
        next_due_date: "2026-01-15",
        status: "active",
      })
    );
    expect(result).toEqual({ id: "new-task-id" });
  });

  it("marks the template ended when the recurrence's end condition is reached", async () => {
    const insertBuilder = createQueryBuilder(okResult({ id: "new-task-id" }));
    const updateBuilder = createQueryBuilder(okResult(null));

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "tasks") return insertBuilder;
      if (table === "recurring_task_templates") return updateBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const endingTemplate: RecurringTaskTemplate = {
      ...baseTemplate,
      end_condition: "after_occurrences",
      end_after_occurrences: 3,
      generated_count: 2,
    };

    await createTaskInstanceFromTemplate(endingTemplate, "2026-01-08");

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ next_due_date: null, status: "ended" })
    );
  });

  it("throws when the task insert fails", async () => {
    supabaseMock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: "insert failed" } }));

    await expect(createTaskInstanceFromTemplate(baseTemplate, "2026-01-08")).rejects.toEqual({
      message: "insert failed",
    });
  });
});

describe("createNextRecurringTaskOnCompletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns false for a task with no recurring template", async () => {
    const result = await createNextRecurringTaskOnCompletion({ recurring_template_id: null, complete: true });
    expect(result).toBe(false);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("returns false when the task is already marked complete", async () => {
    const result = await createNextRecurringTaskOnCompletion({
      recurring_template_id: "template-1",
      complete: true,
    });
    expect(result).toBe(false);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("returns false when the template isn't active or isn't an on_completion template", async () => {
    supabaseMock.from.mockReturnValue(
      createQueryBuilder(okResult({ ...baseTemplate, status: "paused", creation_mode: "on_completion" }))
    );

    const result = await createNextRecurringTaskOnCompletion({
      recurring_template_id: "template-1",
      complete: false,
    });

    expect(result).toBe(false);
  });

  it("returns false when the template has no next_due_date", async () => {
    supabaseMock.from.mockReturnValue(
      createQueryBuilder(
        okResult({ ...baseTemplate, status: "active", creation_mode: "on_completion", next_due_date: null })
      )
    );

    const result = await createNextRecurringTaskOnCompletion({
      recurring_template_id: "template-1",
      complete: false,
    });

    expect(result).toBe(false);
  });

  it("creates the next task instance for an active on_completion template", async () => {
    const activeTemplate = { ...baseTemplate, status: "active", creation_mode: "on_completion" };
    const insertBuilder = createQueryBuilder(okResult({ id: "new-task-id" }));
    const updateBuilder = createQueryBuilder(okResult(null));

    // Calls happen in order: fetch template, insert task, update template.
    supabaseMock.from
      .mockReturnValueOnce(createQueryBuilder(okResult(activeTemplate)))
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(updateBuilder);

    const result = await createNextRecurringTaskOnCompletion({
      recurring_template_id: "template-1",
      complete: false,
    });

    expect(result).toBe(true);
    expect(insertBuilder.insert).toHaveBeenCalled();
  });
});
