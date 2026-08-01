import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACTIVE_MODULES,
  getModuleKeyForPath,
  isRequiredModule,
  normalizeActiveModules,
  REQUIRED_MODULES,
} from "./modules";

describe("isRequiredModule", () => {
  it("returns true for required modules", () => {
    for (const moduleKey of REQUIRED_MODULES) {
      expect(isRequiredModule(moduleKey)).toBe(true);
    }
  });

  it("returns false for an optional module", () => {
    expect(isRequiredModule("meetings")).toBe(false);
  });
});

describe("normalizeActiveModules", () => {
  it("fills in defaults when given nothing", () => {
    expect(normalizeActiveModules(undefined)).toEqual(DEFAULT_ACTIVE_MODULES);
    expect(normalizeActiveModules(null)).toEqual(DEFAULT_ACTIVE_MODULES);
  });

  it("respects explicit overrides for optional modules", () => {
    const result = normalizeActiveModules({ meetings: true, calendar: false });
    expect(result.meetings).toBe(true);
    expect(result.calendar).toBe(false);
  });

  it("always forces home/tasks/people to true even if disabled explicitly", () => {
    const result = normalizeActiveModules({ home: false, tasks: false, people: false });
    expect(result.home).toBe(true);
    expect(result.tasks).toBe(true);
    expect(result.people).toBe(true);
  });
});

describe("getModuleKeyForPath", () => {
  it("maps task-related paths to tasks", () => {
    expect(getModuleKeyForPath("/tasks")).toBe("tasks");
    expect(getModuleKeyForPath("/tasks/projects")).toBe("tasks");
    expect(getModuleKeyForPath("/inbox")).toBe("tasks");
    expect(getModuleKeyForPath("/projects")).toBe("tasks");
    expect(getModuleKeyForPath("/waiting")).toBe("tasks");
    expect(getModuleKeyForPath("/someday")).toBe("tasks");
  });

  it("maps other module paths correctly", () => {
    expect(getModuleKeyForPath("/people")).toBe("people");
    expect(getModuleKeyForPath("/people/123")).toBe("people");
    expect(getModuleKeyForPath("/groups")).toBe("groups");
    expect(getModuleKeyForPath("/sermon-hub")).toBe("sermon_hub");
    expect(getModuleKeyForPath("/calendar")).toBe("calendar");
    expect(getModuleKeyForPath("/meetings")).toBe("meetings");
    expect(getModuleKeyForPath("/service-planner")).toBe("service_planner");
  });

  it("falls back to home for unrecognized paths", () => {
    expect(getModuleKeyForPath("/")).toBe("home");
    expect(getModuleKeyForPath("/settings")).toBe("home");
  });
});
