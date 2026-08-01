import { describe, expect, it } from "vitest";

import { ACTSIX_RELEASE_MODE, getReleaseLabel, isAlphaMode, isModuleEnabled } from "./releaseMode";

// VITE_ACTSIX_RELEASE_MODE isn't set in this environment, so the module
// defaults to "alpha" - these tests exercise that default.
describe("releaseMode (alpha default)", () => {
  it("defaults to alpha mode", () => {
    expect(ACTSIX_RELEASE_MODE).toBe("alpha");
    expect(isAlphaMode).toBe(true);
  });

  it("labels alpha mode correctly", () => {
    expect(getReleaseLabel()).toBe("Alpha");
  });

  it("enables the core alpha modules", () => {
    expect(isModuleEnabled("home")).toBe(true);
    expect(isModuleEnabled("tasks")).toBe(true);
    expect(isModuleEnabled("calendar")).toBe(true);
  });

  it("disables modules reserved for full release", () => {
    expect(isModuleEnabled("resources")).toBe(false);
    expect(isModuleEnabled("chat")).toBe(false);
    expect(isModuleEnabled("reports")).toBe(false);
    expect(isModuleEnabled("media")).toBe(false);
  });

  it("returns false for an unknown module key", () => {
    expect(isModuleEnabled("not_a_real_module" as never)).toBe(false);
  });
});
