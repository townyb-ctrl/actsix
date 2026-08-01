import { describe, expect, it } from "vitest";

import {
  calculateNextDueDate,
  formatFrequencyLabel,
  formatLocalDate,
  getTemplateNextDueDate,
  recurrenceHasEnded,
} from "./recurringTaskDates";

describe("calculateNextDueDate", () => {
  it("advances by days for a daily frequency", () => {
    expect(calculateNextDueDate("2026-01-01", "daily", 1)).toBe("2026-01-02");
    expect(calculateNextDueDate("2026-01-01", "daily", 3)).toBe("2026-01-04");
  });

  it("advances by weeks for a weekly frequency", () => {
    expect(calculateNextDueDate("2026-01-01", "weekly", 1)).toBe("2026-01-08");
    expect(calculateNextDueDate("2026-01-01", "weekly", 2)).toBe("2026-01-15");
  });

  it("advances by months for a monthly frequency", () => {
    expect(calculateNextDueDate("2026-01-15", "monthly", 1)).toBe("2026-02-15");
  });

  it("clamps to the last day of a shorter month instead of overflowing", () => {
    // Jan 31 + 1 month -> Feb has no 31st, should clamp to Feb 28/29
    expect(calculateNextDueDate("2026-01-31", "monthly", 1)).toBe("2026-02-28");
  });

  it("advances by quarters and years", () => {
    expect(calculateNextDueDate("2026-01-15", "quarterly", 1)).toBe("2026-04-15");
    expect(calculateNextDueDate("2026-01-15", "yearly", 1)).toBe("2027-01-15");
  });

  it("treats a missing/invalid interval as 1", () => {
    expect(calculateNextDueDate("2026-01-01", "daily", 0)).toBe("2026-01-02");
    expect(calculateNextDueDate("2026-01-01", "daily", -5)).toBe("2026-01-02");
    // @ts-expect-error exercising the runtime fallback for a non-numeric interval
    expect(calculateNextDueDate("2026-01-01", "daily", "not-a-number")).toBe("2026-01-02");
  });
});

describe("recurrenceHasEnded", () => {
  it("ends when the next due date passes the configured end date", () => {
    expect(
      recurrenceHasEnded({
        endCondition: "on_date",
        endDate: "2026-01-31",
        generatedCount: 1,
        nextDueDate: "2026-02-01",
      })
    ).toBe(true);

    expect(
      recurrenceHasEnded({
        endCondition: "on_date",
        endDate: "2026-01-31",
        generatedCount: 1,
        nextDueDate: "2026-01-15",
      })
    ).toBe(false);
  });

  it("ends after the configured occurrence count is reached", () => {
    expect(
      recurrenceHasEnded({
        endCondition: "after_occurrences",
        endAfterOccurrences: 3,
        generatedCount: 3,
      })
    ).toBe(true);

    expect(
      recurrenceHasEnded({
        endCondition: "after_occurrences",
        endAfterOccurrences: 3,
        generatedCount: 2,
      })
    ).toBe(false);
  });

  it("never ends for the 'never' condition", () => {
    expect(
      recurrenceHasEnded({
        endCondition: "never",
        generatedCount: 9999,
      })
    ).toBe(false);
  });
});

describe("getTemplateNextDueDate", () => {
  it("prefers next_due_date when set", () => {
    expect(
      getTemplateNextDueDate({
        next_due_date: "2026-02-01",
        first_due_date: "2026-01-01",
        frequency: "monthly",
        interval: 1,
      })
    ).toBe("2026-02-01");
  });

  it("falls back to first_due_date when next_due_date is unset", () => {
    expect(
      getTemplateNextDueDate({
        next_due_date: null,
        first_due_date: "2026-01-01",
        frequency: "monthly",
        interval: 1,
      })
    ).toBe("2026-01-01");
  });
});

describe("formatFrequencyLabel", () => {
  it("uses singular phrasing for an interval of 1", () => {
    expect(formatFrequencyLabel("daily", 1)).toBe("Every day");
    expect(formatFrequencyLabel("weekly", 1)).toBe("Every week");
  });

  it("uses plural phrasing for larger intervals", () => {
    expect(formatFrequencyLabel("monthly", 2)).toBe("Every 2 months");
    expect(formatFrequencyLabel("yearly", 3)).toBe("Every 3 years");
  });

  it("treats a missing/invalid interval as 1", () => {
    expect(formatFrequencyLabel("daily", 0)).toBe("Every day");
  });
});

describe("formatLocalDate", () => {
  it("zero-pads month and day", () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
