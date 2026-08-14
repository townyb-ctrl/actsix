import { describe, expect, it } from "vitest";

import {
  assignmentLabel,
  positionsByDay,
  unfilledCount,
  type VenuePosition,
  type VenuePositionAssignment,
} from "./venuePositions";

const position = (overrides: Partial<VenuePosition> & { id: string }): VenuePosition => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  role_id: "role-ops",
  starts_at: "2026-09-10T08:00:00.000Z",
  ends_at: "2026-09-10T12:00:00.000Z",
  needed: 1,
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const assignment = (
  overrides: Partial<VenuePositionAssignment> & { id: string; position_id: string }
): VenuePositionAssignment => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  person_id: null,
  display_name: "Rens",
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

describe("unfilledCount", () => {
  it("is the whole requirement when nobody is assigned", () => {
    expect(unfilledCount(position({ id: "p1", needed: 2 }), [])).toBe(2);
  });

  it("drops as people are assigned", () => {
    const assignments = [assignment({ id: "a1", position_id: "p1" })];

    expect(unfilledCount(position({ id: "p1", needed: 2 }), assignments)).toBe(1);
  });

  it("is zero once the requirement is met", () => {
    const assignments = [
      assignment({ id: "a1", position_id: "p1" }),
      assignment({ id: "a2", position_id: "p1" }),
    ];

    expect(unfilledCount(position({ id: "p1", needed: 2 }), assignments)).toBe(0);
  });

  it("never goes negative when more people are assigned than needed", () => {
    const assignments = [
      assignment({ id: "a1", position_id: "p1" }),
      assignment({ id: "a2", position_id: "p1" }),
      assignment({ id: "a3", position_id: "p1" }),
    ];

    expect(unfilledCount(position({ id: "p1", needed: 1 }), assignments)).toBe(0);
  });

  it("ignores assignments belonging to another position", () => {
    const assignments = [assignment({ id: "a1", position_id: "p2" })];

    expect(unfilledCount(position({ id: "p1", needed: 1 }), assignments)).toBe(1);
  });
});

describe("positionsByDay", () => {
  it("groups by the day the shift starts, in order", () => {
    const days = positionsByDay([
      position({ id: "p2", starts_at: "2026-09-11T08:00:00.000Z", ends_at: "2026-09-11T12:00:00.000Z" }),
      position({ id: "p1", starts_at: "2026-09-10T08:00:00.000Z", ends_at: "2026-09-10T12:00:00.000Z" }),
    ]);

    expect(days.map((day) => day.positions[0].id)).toEqual(["p1", "p2"]);
  });

  it("orders a day's shifts by start time", () => {
    const days = positionsByDay([
      position({ id: "late", starts_at: "2026-09-10T18:00:00.000Z", ends_at: "2026-09-10T22:00:00.000Z" }),
      position({ id: "early", starts_at: "2026-09-10T06:00:00.000Z", ends_at: "2026-09-10T10:00:00.000Z" }),
    ]);

    expect(days[0].positions.map((entry) => entry.id)).toEqual(["early", "late"]);
  });

  it("returns nothing when no positions exist", () => {
    expect(positionsByDay([])).toEqual([]);
  });
});

describe("assignmentLabel", () => {
  const people = [{ id: "person-1", first_name: "Hannah", last_name: "Meyer" }];

  it("uses the directory name when the assignment points at a person", () => {
    const entry = assignment({ id: "a1", position_id: "p1", person_id: "person-1", display_name: "" });

    expect(assignmentLabel(entry, people)).toBe("Hannah Meyer");
  });

  it("falls back to the typed name for someone not in the directory", () => {
    const entry = assignment({ id: "a1", position_id: "p1", person_id: null, display_name: "Andre" });

    expect(assignmentLabel(entry, people)).toBe("Andre");
  });

  it("falls back to the typed name when the person has been deleted since", () => {
    const entry = assignment({
      id: "a1",
      position_id: "p1",
      person_id: "gone",
      display_name: "Andre",
    });

    expect(assignmentLabel(entry, people)).toBe("Andre");
  });

  it("handles a person with no surname", () => {
    const entry = assignment({ id: "a1", position_id: "p1", person_id: "person-2", display_name: "" });

    expect(assignmentLabel(entry, [{ id: "person-2", first_name: "Gianna", last_name: null }])).toBe(
      "Gianna"
    );
  });

  it("says so rather than rendering blank when nothing identifies them", () => {
    const entry = assignment({ id: "a1", position_id: "p1", person_id: "gone", display_name: "" });

    expect(assignmentLabel(entry, people)).toBe("Unknown");
  });
});
