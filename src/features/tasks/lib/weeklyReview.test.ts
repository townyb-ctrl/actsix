import { describe, expect, it } from "vitest";

import { isOverdueFollowUp, isStalledProject } from "./weeklyReview";

describe("isStalledProject", () => {
  it("flags an active project with open tasks but no next action", () => {
    expect(isStalledProject({ id: "1", name: "Camp", status: "Active", open_tasks: 3, next_action: "" })).toBe(
      true
    );
  });

  it("treats whitespace-only next_action as missing", () => {
    expect(
      isStalledProject({ id: "1", name: "Camp", status: "Active", open_tasks: 3, next_action: "   " })
    ).toBe(true);
  });

  it("does not flag a project that has a next action", () => {
    expect(
      isStalledProject({ id: "1", name: "Camp", status: "Active", open_tasks: 3, next_action: "Book venue" })
    ).toBe(false);
  });

  it("does not flag a project with no open tasks", () => {
    expect(isStalledProject({ id: "1", name: "Camp", status: "Active", open_tasks: 0, next_action: "" })).toBe(
      false
    );
  });

  it("does not flag completed or archived projects regardless of next_action", () => {
    expect(
      isStalledProject({ id: "1", name: "Camp", status: "Completed", open_tasks: 3, next_action: "" })
    ).toBe(false);
    expect(
      isStalledProject({ id: "1", name: "Camp", status: "Archived", open_tasks: 3, next_action: "" })
    ).toBe(false);
  });
});

describe("isOverdueFollowUp", () => {
  const today = "2026-06-15";

  it("flags a follow-up date on or before today", () => {
    expect(isOverdueFollowUp({ id: "1", item: "Call Sam", follow_up_date: "2026-06-15" }, today)).toBe(true);
    expect(isOverdueFollowUp({ id: "1", item: "Call Sam", follow_up_date: "2026-06-01" }, today)).toBe(true);
  });

  it("does not flag a future follow-up date", () => {
    expect(isOverdueFollowUp({ id: "1", item: "Call Sam", follow_up_date: "2026-06-20" }, today)).toBe(false);
  });

  it("does not flag an item with no follow-up date", () => {
    expect(isOverdueFollowUp({ id: "1", item: "Call Sam", follow_up_date: null }, today)).toBe(false);
  });
});
