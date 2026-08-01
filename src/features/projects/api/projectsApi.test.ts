import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  addProjectCollaborators,
  getPeopleByIds,
  updateProjectTaskCompletion,
  upsertProjectCalendarEvent,
  upsertProjectSection,
} from "./projectsApi";

describe("upsertProjectSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("updates an existing section when sectionId is given", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertProjectSection({
      sectionId: "section-1",
      userId: "user-1",
      projectId: "project-1",
      payload: { name: "Renamed" },
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("project_sections");
    expect(builder.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(builder.eq).toHaveBeenCalledWith("id", "section-1");
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it("inserts a new section (with user/project ids attached) when no sectionId is given", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertProjectSection({
      userId: "user-1",
      projectId: "project-1",
      payload: { name: "New Section" },
    });

    expect(builder.insert).toHaveBeenCalledWith({
      name: "New Section",
      user_id: "user-1",
      project_id: "project-1",
    });
    expect(builder.update).not.toHaveBeenCalled();
  });
});

describe("updateProjectTaskCompletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sets completed_at when marking a task complete", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    updateProjectTaskCompletion({ taskId: "task-1", complete: true });

    const [payload] = builder.update.mock.calls[0];
    expect(payload.complete).toBe(true);
    expect(typeof payload.completed_at).toBe("string");
  });

  it("clears completed_at when marking a task incomplete", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    updateProjectTaskCompletion({ taskId: "task-1", complete: false });

    const [payload] = builder.update.mock.calls[0];
    expect(payload.complete).toBe(false);
    expect(payload.completed_at).toBeNull();
  });
});

describe("addProjectCollaborators", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps each person id to a collaborator row with a default role", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    addProjectCollaborators({ userId: "user-1", projectId: "project-1", personIds: ["p1", "p2"] });

    expect(builder.insert).toHaveBeenCalledWith([
      { user_id: "user-1", project_id: "project-1", person_id: "p1", role: "Collaborator" },
      { user_id: "user-1", project_id: "project-1", person_id: "p2", role: "Collaborator" },
    ]);
  });

  it("honors an explicit role override", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    addProjectCollaborators({ userId: "user-1", projectId: "project-1", personIds: ["p1"], role: "Owner" });

    expect(builder.insert).toHaveBeenCalledWith([
      { user_id: "user-1", project_id: "project-1", person_id: "p1", role: "Owner" },
    ]);
  });
});

describe("getPeopleByIds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("filters out null/undefined ids before querying", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getPeopleByIds({ workspaceId: "workspace-1", personIds: ["p1", null, undefined, "p2"] });

    expect(builder.in).toHaveBeenCalledWith("id", ["p1", "p2"]);
  });

  it("falls back to the empty-workspace sentinel when no workspaceId is given", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getPeopleByIds({ workspaceId: null, personIds: ["p1"] });

    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "00000000-0000-0000-0000-000000000000");
  });
});

describe("upsertProjectCalendarEvent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns no-op when the project has no due date or event start", async () => {
    const result = await upsertProjectCalendarEvent({
      project: { name: "No date project" },
      userId: "user-1",
      workspaceId: "workspace-1",
    });

    expect(result).toEqual({ data: null, error: null });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("inserts an all-day event using the project's due date when it's not a dedicated event", async () => {
    const builder = createQueryBuilder(okResult({ id: "event-1" }));
    supabaseMock.from.mockReturnValue(builder);

    await upsertProjectCalendarEvent({
      project: { name: "Ship the report", due_date: "2026-03-01", status: "Open" },
      userId: "user-1",
      workspaceId: "workspace-1",
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Project due: Ship the report",
        all_day: true,
        status: "Confirmed",
      })
    );
  });

  it("updates the existing calendar event when the project already has one linked", async () => {
    const builder = createQueryBuilder(okResult({ id: "event-1" }));
    supabaseMock.from.mockReturnValue(builder);

    await upsertProjectCalendarEvent({
      project: {
        name: "Ship the report",
        due_date: "2026-03-01",
        calendar_event_id: "event-1",
        status: "Completed",
      },
      userId: "user-1",
      workspaceId: "workspace-1",
    });

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "Tentative" }));
    expect(builder.eq).toHaveBeenCalledWith("id", "event-1");
  });

  it("uses the event's own start/end window and non-all-day flag for dedicated events", async () => {
    const builder = createQueryBuilder(okResult({ id: "event-1" }));
    supabaseMock.from.mockReturnValue(builder);

    await upsertProjectCalendarEvent({
      project: {
        name: "Team Retreat",
        is_event: true,
        event_start_at: "2026-03-01T09:00:00",
        event_end_at: "2026-03-01T17:00:00",
      },
      userId: "user-1",
      workspaceId: "workspace-1",
    });

    const [payload] = builder.insert.mock.calls[0];
    expect(payload.title).toBe("Team Retreat");
    expect(payload.all_day).toBe(false);
    expect(new Date(payload.ends_at).getTime()).toBe(new Date("2026-03-01T17:00:00").getTime());
  });
});
