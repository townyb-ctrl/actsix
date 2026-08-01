import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { createNotification, createNotificationForPerson, notifyProjectParticipants } from "./notifications";

describe("createNotification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls the user RPC with mapped params and returns no error on success", async () => {
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const result = await createNotification({ recipientUserId: "user-1", title: "Hello" });

    expect(supabaseMock.rpc).toHaveBeenCalledWith("actsix_create_notification_for_user", {
      recipient_user_id: "user-1",
      actor_person_id: null,
      notification_title: "Hello",
      notification_message: null,
      notification_type: "system",
      notification_entity_type: null,
      notification_entity_id: null,
    });
    expect(result).toEqual({ error: null });
  });

  it("logs and returns the error when the RPC fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    supabaseMock.rpc.mockResolvedValue({ error: { message: "boom" } });

    const result = await createNotification({ recipientUserId: "user-1", title: "Hi" });

    expect(result).toEqual({ error: { message: "boom" } });
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("createNotificationForPerson", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("skips the RPC when personId or currentUserId is missing", async () => {
    const result = await createNotificationForPerson({
      personId: "",
      currentUserId: "user-1",
      title: "Hi",
    });

    expect(result).toEqual({ error: null });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("calls the person RPC with mapped params", async () => {
    supabaseMock.rpc.mockResolvedValue({ error: null });

    await createNotificationForPerson({ personId: "person-1", currentUserId: "user-1", title: "Hi" });

    expect(supabaseMock.rpc).toHaveBeenCalledWith("actsix_create_notification_for_person", {
      recipient_person_id: "person-1",
      actor_person_id: null,
      notification_title: "Hi",
      notification_message: null,
      notification_type: "system",
      notification_entity_type: null,
      notification_entity_id: null,
    });
  });
});

describe("notifyProjectParticipants", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("notifies non-excluded collaborators and the owner when not already included", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "projects") {
        return createQueryBuilder(okResult({ id: "project-1", name: "Project", user_id: "owner-1" }));
      }
      if (table === "project_collaborators") {
        return createQueryBuilder(
          okResult([
            { person_id: "person-1", people: { id: "person-1", auth_user_id: "auth-1" } },
            { person_id: "person-2", people: { id: "person-2", auth_user_id: "auth-2" } },
          ])
        );
      }
      throw new Error(`Unexpected table ${table}`);
    });
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const result = await notifyProjectParticipants({
      projectId: "project-1",
      currentUserId: "current-user",
      actorPersonId: "person-1",
      title: "Task updated",
    });

    expect(result).toEqual({ error: null });
    // person-1 is the actor, so only person-2 gets the person RPC
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "actsix_create_notification_for_person",
      expect.objectContaining({ recipient_person_id: "person-2" })
    );
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      "actsix_create_notification_for_person",
      expect.objectContaining({ recipient_person_id: "person-1" })
    );
    // owner isn't a collaborator, so they get notified via the user RPC too
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "actsix_create_notification_for_user",
      expect.objectContaining({ recipient_user_id: "owner-1" })
    );
  });

  it("does not double-notify the owner when they're already a collaborator", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "projects") {
        return createQueryBuilder(okResult({ id: "project-1", name: "Project", user_id: "owner-1" }));
      }
      if (table === "project_collaborators") {
        return createQueryBuilder(
          okResult([{ person_id: "owner-person", people: { id: "owner-person", auth_user_id: "owner-1" } }])
        );
      }
      throw new Error(`Unexpected table ${table}`);
    });
    supabaseMock.rpc.mockResolvedValue({ error: null });

    await notifyProjectParticipants({
      projectId: "project-1",
      currentUserId: "current-user",
      title: "Task updated",
    });

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
  });

  it("returns the error without notifying anyone when the project lookup fails", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "projects") {
        return createQueryBuilder({ data: null, error: { message: "not found" } });
      }
      return createQueryBuilder(okResult([]));
    });

    const result = await notifyProjectParticipants({
      projectId: "missing-project",
      currentUserId: "current-user",
      title: "Task updated",
    });

    expect(result).toEqual({ error: { message: "not found" } });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
