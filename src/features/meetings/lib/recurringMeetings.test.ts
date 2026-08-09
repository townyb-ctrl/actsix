import { describe, expect, it } from "vitest";
import {
  addMonths,
  toDateInputValue,
  buildOccurrences,
  fromRecurringMeetingRow,
} from "./recurringMeetings";

describe("addMonths", () => {
  it("advances the month, keeping day/year sane", () => {
    expect(toDateInputValue(addMonths(new Date("2026-01-15T00:00:00"), 1))).toBe("2026-02-15");
  });

  it("rolls over into the next year", () => {
    expect(toDateInputValue(addMonths(new Date("2026-12-01T00:00:00"), 1))).toBe("2027-01-01");
  });

  it("clamps a month-end date that doesn't exist in the target month (JS Date rollover)", () => {
    // Jan 31 + 1 month -> Date rolls to Mar 3 (Feb has no 31st). This is the
    // documented ceiling of the naive addMonths approach.
    expect(toDateInputValue(addMonths(new Date("2026-01-31T00:00:00"), 1))).toBe("2026-03-03");
  });
});

describe("buildOccurrences", () => {
  it("returns nothing without a start date", () => {
    expect(buildOccurrences({ frequency: "Weekly" })).toEqual([]);
  });

  it("spaces weekly occurrences 7 days apart", () => {
    const occ = buildOccurrences({ startDate: "2026-01-01", frequency: "Weekly", occurrences: 3 });
    expect(occ.map((o) => o.date)).toEqual(["2026-01-01", "2026-01-08", "2026-01-15"]);
    expect(occ.map((o) => o.number)).toEqual([1, 2, 3]);
  });

  it("spaces monthly occurrences by calendar month", () => {
    const occ = buildOccurrences({ startDate: "2026-01-31", frequency: "Monthly", occurrences: 3 });
    expect(occ.map((o) => o.date)).toEqual(["2026-01-31", "2026-03-03", "2026-03-31"]);
  });

  it("defaults to 12 occurrences when unset", () => {
    expect(buildOccurrences({ startDate: "2026-01-01", frequency: "Weekly" })).toHaveLength(12);
  });
});

describe("fromRecurringMeetingRow", () => {
  it("maps DB row fields, defaulting missing ones", () => {
    const row = { id: "s1", title: "Standup", frequency: "Monthly" };
    const series = fromRecurringMeetingRow(row);
    expect(series).toMatchObject({
      id: "s1",
      title: "Standup",
      frequency: "Monthly",
      startDate: "",
      occurrences: 12,
      regularAttendees: [],
      regularAgenda: [],
    });
  });

  it("falls back to Weekly for an unrecognized frequency", () => {
    expect(fromRecurringMeetingRow({ id: "s2", title: "X", frequency: "Daily" }).frequency).toBe("Weekly");
  });

  // regular_agenda rows written before the series shared the meeting agenda
  // model hold only {heading, points:[{text}]}. They have to arrive as whole
  // sections or the agenda editor renders undefined into every field.
  it("backfills a legacy regular_agenda row into complete agenda sections", () => {
    const [section] = fromRecurringMeetingRow({
      id: "s3",
      title: "Elders",
      regular_agenda: [{ heading: "Budget", points: [{ text: "Q1 review" }] }],
    }).regularAgenda;

    expect(section).toMatchObject({ heading: "Budget", subtitle: "", layout: "list" });
    expect(section.id).toEqual(expect.any(String));
    expect(section.points[0]).toMatchObject({ text: "Q1 review", date: "", ownerId: "", ownerName: "", children: [] });
    expect(section.points[0].id).toEqual(expect.any(String));
  });
});

// generateMinutesFromAgenda is re-exported from meetingAgenda now - one
// generator for both surfaces - and is covered by meetingAgenda.test.ts.
