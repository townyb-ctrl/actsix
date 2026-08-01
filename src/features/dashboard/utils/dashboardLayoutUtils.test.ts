import { describe, expect, it } from "vitest";

import type {
  DashboardProject,
  DashboardTask,
  DashboardWidgetDefinition,
  UserDashboardLayout,
  UserDashboardWidget,
} from "@/features/dashboard/types/dashboardTypes";

import {
  addDays,
  formatDate,
  formatShortDate,
  formatTime,
  getNextWidgetSize,
  moveWidget,
  normalizeDashboardLayout,
  priorityClass,
  projectProgress,
  reorderWidgets,
  resizeWidget,
  toDateKey,
  touchLayout,
} from "./dashboardLayoutUtils";

const widget = (id: string, definitionId = id): UserDashboardWidget => ({
  id,
  definitionId,
  size: "small",
});

describe("moveWidget", () => {
  const widgets = [widget("a"), widget("b"), widget("c")];

  it("moves a widget up one position", () => {
    const result = moveWidget(widgets, "b", "up");
    expect(result.map((w) => w.id)).toEqual(["b", "a", "c"]);
  });

  it("moves a widget down one position", () => {
    const result = moveWidget(widgets, "b", "down");
    expect(result.map((w) => w.id)).toEqual(["a", "c", "b"]);
  });

  it("returns the same list when already at the top/bottom", () => {
    expect(moveWidget(widgets, "a", "up")).toBe(widgets);
    expect(moveWidget(widgets, "c", "down")).toBe(widgets);
  });

  it("returns the same list for an unknown widget id", () => {
    expect(moveWidget(widgets, "missing", "up")).toBe(widgets);
  });
});

describe("reorderWidgets", () => {
  const widgets = [widget("a"), widget("b"), widget("c")];

  it("moves the active widget to the position of the target widget", () => {
    const result = reorderWidgets(widgets, "a", "c");
    expect(result.map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  it("returns the same list when either id is unknown or they're equal", () => {
    expect(reorderWidgets(widgets, "a", "a")).toBe(widgets);
    expect(reorderWidgets(widgets, "missing", "b")).toBe(widgets);
    expect(reorderWidgets(widgets, "a", "missing")).toBe(widgets);
  });
});

describe("resizeWidget", () => {
  it("updates only the matching widget's size", () => {
    const widgets = [widget("a"), widget("b")];
    const result = resizeWidget(widgets, "b", "large");

    expect(result.find((w) => w.id === "a")?.size).toBe("small");
    expect(result.find((w) => w.id === "b")?.size).toBe("large");
  });
});

describe("getNextWidgetSize", () => {
  it("cycles through sizes in order and wraps around", () => {
    expect(getNextWidgetSize("small")).toBe("medium");
    expect(getNextWidgetSize("medium")).toBe("large");
    expect(getNextWidgetSize("large")).toBe("full");
    expect(getNextWidgetSize("full")).toBe("small");
  });
});

describe("normalizeDashboardLayout", () => {
  const definitions = [{ id: "tasks" }, { id: "projects" }] as DashboardWidgetDefinition[];
  const fallback: UserDashboardLayout = { version: 1, widgets: [], updatedAt: "fallback" };

  it("returns the fallback when the layout has no widgets", () => {
    expect(normalizeDashboardLayout(null, fallback, definitions)).toBe(fallback);
    expect(normalizeDashboardLayout({ version: 1, widgets: [], updatedAt: "x" }, fallback, definitions)).toBe(
      fallback
    );
  });

  it("drops widgets whose definition no longer exists", () => {
    const layout: UserDashboardLayout = {
      version: 1,
      widgets: [widget("a", "tasks"), widget("b", "removed-widget-type")],
      updatedAt: "2026-01-01",
    };

    const result = normalizeDashboardLayout(layout, fallback, definitions);
    expect(result.widgets.map((w) => w.id)).toEqual(["a"]);
  });

  it("returns the fallback when every widget's definition has been removed", () => {
    const layout: UserDashboardLayout = {
      version: 1,
      widgets: [widget("a", "removed-widget-type")],
      updatedAt: "2026-01-01",
    };

    expect(normalizeDashboardLayout(layout, fallback, definitions)).toBe(fallback);
  });
});

describe("touchLayout", () => {
  it("preserves widgets while refreshing updatedAt", () => {
    const layout: UserDashboardLayout = { version: 1, widgets: [widget("a")], updatedAt: "old" };
    const result = touchLayout(layout);

    expect(result.widgets).toBe(layout.widgets);
    expect(result.updatedAt).not.toBe("old");
  });
});

describe("date helpers", () => {
  it("addDays advances the date without mutating the input", () => {
    const start = new Date(2026, 0, 1);
    const result = addDays(start, 5);

    expect(toDateKey(result)).toBe("2026-01-06");
    expect(toDateKey(start)).toBe("2026-01-01");
  });

  it("toDateKey zero-pads month and day", () => {
    expect(toDateKey(new Date(2026, 2, 5))).toBe("2026-03-05");
  });

  it("formatDate/formatShortDate return a placeholder for missing values", () => {
    expect(formatDate(null)).toBe("No date");
    expect(formatShortDate(undefined)).toBe("No date");
  });

  it("formatTime returns null for a missing value", () => {
    expect(formatTime(null)).toBeNull();
  });

  it("formatTime formats an HH:MM string", () => {
    expect(formatTime("14:30")).toMatch(/2:30/);
  });
});

describe("priorityClass", () => {
  it("returns a distinct class per priority tier", () => {
    expect(priorityClass("Urgent")).toContain("brand-danger");
    expect(priorityClass("High")).toContain("brand-bronze");
    expect(priorityClass("Medium")).toContain("brand-teal");
    expect(priorityClass(null)).toContain("brand-teal");
  });
});

describe("projectProgress", () => {
  const project: DashboardProject = { id: "project-1", name: "Website Redesign" };

  it("computes progress from linked tasks", () => {
    const tasks: DashboardTask[] = [
      { id: "t1", title: "Design", project_id: "project-1", complete: true },
      { id: "t2", title: "Build", project_id: "project-1", complete: false },
    ];

    const result = projectProgress(project, tasks);

    expect(result.openTasks).toBe(1);
    expect(result.progress).toBe(50);
    expect(result.nextAction).toBe("Build");
  });

  it("matches tasks by project name when project_id is absent", () => {
    const tasks: DashboardTask[] = [{ id: "t1", title: "Design", project: "Website Redesign", complete: false }];

    const result = projectProgress(project, tasks);
    expect(result.openTasks).toBe(1);
  });

  it("falls back to the project's own stats when it has no linked tasks", () => {
    const projectWithStats: DashboardProject = {
      ...project,
      open_tasks: 4,
      progress: 25,
      next_action: "Stored next action",
    };

    const result = projectProgress(projectWithStats, []);

    expect(result).toEqual({ openTasks: 4, progress: 25, nextAction: "Stored next action" });
  });

  it("falls back to a default message when there's no next action anywhere", () => {
    const tasks: DashboardTask[] = [{ id: "t1", title: "Design", project_id: "project-1", complete: true }];
    const result = projectProgress(project, tasks);
    expect(result.nextAction).toBe("No next action set");
  });
});
