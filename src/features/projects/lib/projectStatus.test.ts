import { describe, expect, it } from "vitest";

import { isProjectComplete, needsAction } from "./projectStatus";

const stats = (progress: number, openTasks = 0) => ({
  progress,
  openTasks: Array.from({ length: openTasks }, (_, i) => i),
});

describe("isProjectComplete", () => {
  it("treats full progress as complete", () => {
    expect(isProjectComplete({}, stats(100))).toBe(true);
  });

  it("treats an explicit complete status as complete even at partial progress", () => {
    expect(isProjectComplete({ status: "Completed" }, stats(60))).toBe(true);
  });

  it("matches the status case-insensitively and as a substring", () => {
    expect(isProjectComplete({ status: "complete" }, stats(0))).toBe(true);
  });

  it("is not complete while progress is partial and no status says otherwise", () => {
    expect(isProjectComplete({ status: "In Progress" }, stats(99))).toBe(false);
  });

  it("returns a boolean, not undefined, when there is no status and no stats", () => {
    expect(isProjectComplete({})).toBe(false);
  });
});

describe("needsAction", () => {
  it("flags an open project with no open tasks", () => {
    expect(needsAction({ status: "In Progress" }, stats(40, 0))).toBe(true);
  });

  it("does not flag a project that still has open tasks", () => {
    expect(needsAction({ status: "In Progress" }, stats(40, 3))).toBe(false);
  });

  it("does not flag a completed project, even with zero open tasks", () => {
    expect(needsAction({}, stats(100, 0))).toBe(false);
  });

  // The bug this replaced: needs-action only checked progress < 100, so a
  // project marked Completed at partial progress landed in Needs Action *and*
  // under the Complete group at the same time.
  it("does not flag a project marked complete at partial progress", () => {
    expect(needsAction({ status: "Completed" }, stats(60, 0))).toBe(false);
  });

  it("is never true without stats", () => {
    expect(needsAction({ status: "In Progress" })).toBe(false);
  });
});

describe("active and complete partition the set", () => {
  const cases = [
    { project: {}, stat: stats(100, 0) },
    { project: { status: "Completed" }, stat: stats(60, 2) },
    { project: { status: "In Progress" }, stat: stats(0, 5) },
    { project: { status: "In Progress" }, stat: stats(99, 1) },
    { project: { status: null }, stat: stats(40, 0) },
  ];

  it.each(cases)("every project is exactly one of active or complete (%#)", ({ project, stat }) => {
    const complete = isProjectComplete(project, stat);
    const active = !complete;
    expect(complete !== active).toBe(true);
  });

  it.each(cases)("needs-action implies active (%#)", ({ project, stat }) => {
    if (needsAction(project, stat)) {
      expect(isProjectComplete(project, stat)).toBe(false);
    }
  });
});
