import { describe, expect, it } from "vitest";

import { normalizeUserSettings } from "./useUserSettings";

describe("normalizeUserSettings", () => {
  it("returns the default settings for a non-object value", () => {
    expect(normalizeUserSettings(null)).toEqual({
      onboarding: { homeTourComplete: false, completedModuleTours: {} },
      modules: expect.objectContaining({ home: true, tasks: true, people: true }),
    });
    expect(normalizeUserSettings(undefined)).toEqual(normalizeUserSettings(null));
    expect(normalizeUserSettings("not an object")).toEqual(normalizeUserSettings(null));
    expect(normalizeUserSettings([1, 2, 3])).toEqual(normalizeUserSettings(null));
  });

  it("preserves valid onboarding and module data", () => {
    const result = normalizeUserSettings({
      onboarding: {
        homeTourComplete: true,
        completedModuleTours: { tasks: true, people: false },
      },
      modules: { meetings: true, calendar: false },
    });

    expect(result.onboarding.homeTourComplete).toBe(true);
    expect(result.onboarding.completedModuleTours).toEqual({ tasks: true, people: false });
    expect(result.modules.meetings).toBe(true);
    expect(result.modules.calendar).toBe(false);
    // required modules always stay on regardless of stored value
    expect(result.modules.home).toBe(true);
    expect(result.modules.tasks).toBe(true);
    expect(result.modules.people).toBe(true);
  });

  it("coerces a truthy-but-not-boolean homeTourComplete", () => {
    const result = normalizeUserSettings({ onboarding: { homeTourComplete: "yes" } });
    expect(result.onboarding.homeTourComplete).toBe(true);
  });

  it("falls back to empty onboarding/module data when those fields are malformed", () => {
    const result = normalizeUserSettings({ onboarding: "not an object", modules: "also not an object" });

    expect(result.onboarding).toEqual({ homeTourComplete: false, completedModuleTours: {} });
    expect(result.modules).toEqual(expect.objectContaining({ home: true, tasks: true, people: true }));
  });
});
