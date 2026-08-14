import { describe, expect, it } from "vitest";

import { runSheetByDay, type VenueRunSheetItem } from "./venueRunSheet";

const item = (overrides: Partial<VenueRunSheetItem> & { id: string }): VenueRunSheetItem => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  space_id: "hall",
  title: "Registration",
  starts_at: "2026-09-10T08:00:00.000Z",
  ends_at: "2026-09-10T09:00:00.000Z",
  setup_notes: "",
  av_notes: "",
  access_notes: "",
  risk_notes: "",
  sort_order: 0,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

describe("runSheetByDay", () => {
  it("groups items under the day they start", () => {
    const days = runSheetByDay([
      item({ id: "i1", starts_at: "2026-09-10T08:00:00.000Z", ends_at: "2026-09-10T09:00:00.000Z" }),
      item({ id: "i2", starts_at: "2026-09-11T08:00:00.000Z", ends_at: "2026-09-11T09:00:00.000Z" }),
    ]);

    expect(days).toHaveLength(2);
    expect(days[0].items.map((entry) => entry.id)).toEqual(["i1"]);
    expect(days[1].items.map((entry) => entry.id)).toEqual(["i2"]);
  });

  it("orders a day chronologically regardless of the order they arrive in", () => {
    const days = runSheetByDay([
      item({ id: "late", starts_at: "2026-09-10T14:00:00.000Z", ends_at: "2026-09-10T15:00:00.000Z" }),
      item({ id: "early", starts_at: "2026-09-10T08:00:00.000Z", ends_at: "2026-09-10T09:00:00.000Z" }),
    ]);

    expect(days[0].items.map((entry) => entry.id)).toEqual(["early", "late"]);
  });

  it("breaks a same-time tie on sort_order, so a hand-set running order holds", () => {
    const days = runSheetByDay([
      item({ id: "second", sort_order: 2 }),
      item({ id: "first", sort_order: 1 }),
    ]);

    expect(days[0].items.map((entry) => entry.id)).toEqual(["first", "second"]);
  });

  it("puts the days themselves in order", () => {
    const days = runSheetByDay([
      item({ id: "i2", starts_at: "2026-09-12T08:00:00.000Z", ends_at: "2026-09-12T09:00:00.000Z" }),
      item({ id: "i1", starts_at: "2026-09-09T08:00:00.000Z", ends_at: "2026-09-09T09:00:00.000Z" }),
    ]);

    expect(days.map((day) => day.items[0].id)).toEqual(["i1", "i2"]);
  });

  it("keeps whole-venue items, which belong to no space", () => {
    const days = runSheetByDay([item({ id: "i1", space_id: null })]);

    expect(days[0].items).toHaveLength(1);
    expect(days[0].items[0].space_id).toBeNull();
  });

  it("returns nothing for an empty run sheet", () => {
    expect(runSheetByDay([])).toEqual([]);
  });
});
