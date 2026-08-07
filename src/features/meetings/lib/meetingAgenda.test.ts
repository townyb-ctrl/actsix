import { describe, expect, it } from "vitest";
import {
  parseAgendaPayload,
  serializeAgenda,
  parseAttendees,
  generateMinutesFromAgenda,
  cleanAgendaSections,
  getRecurringSeriesIdFromAgenda,
  cleanNameList,
} from "./meetingAgenda";

describe("parseAgendaPayload", () => {
  it("returns a single empty section for no stored value", () => {
    const payload = parseAgendaPayload(null);
    expect(payload.sections).toHaveLength(1);
    expect(payload.apologies).toEqual([]);
  });

  it("round-trips a v1 JSON payload", () => {
    const stored = serializeAgenda(
      [{ id: "a", heading: "Budget", points: [{ id: "p1", text: "Q1" }] }],
      ["Jane"]
    );
    const payload = parseAgendaPayload(stored);
    expect(payload.sections).toEqual([{ id: "a", heading: "Budget", points: [{ id: "p1", text: "Q1" }] }]);
    expect(payload.apologies).toEqual(["Jane"]);
  });

  it("falls back to a single 'Agenda' section for legacy plain text", () => {
    const payload = parseAgendaPayload("Discuss budget\nApprove minutes");
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].heading).toBe("Agenda");
    expect(payload.sections[0].points.map((p) => p.text)).toEqual(["Discuss budget", "Approve minutes"]);
  });

  it("falls back to plain text parsing on malformed JSON", () => {
    const payload = parseAgendaPayload("{not valid json");
    expect(payload.sections[0].heading).toBe("Agenda");
  });

  it("fills a missing point id and accepts legacy string points", () => {
    const stored = JSON.stringify({
      type: "actsix-agenda-v1",
      sections: [{ heading: "Old", points: ["plain string point"] }],
    });
    const payload = parseAgendaPayload(stored);
    expect(payload.sections[0].points[0].text).toBe("plain string point");
    expect(payload.sections[0].points[0].id).toBeTruthy();
  });
});

describe("cleanNameList", () => {
  it("trims and drops blanks", () => {
    expect(cleanNameList([" Jane ", "", "  ", "Bob"])).toEqual(["Jane", "Bob"]);
  });
});

describe("parseAttendees", () => {
  it("splits on commas and newlines, trims blanks", () => {
    expect(parseAttendees("Jane, Bob\n , Alice")).toEqual(["Jane", "Bob", "Alice"]);
  });
});

describe("generateMinutesFromAgenda", () => {
  it("returns empty string when every section is blank", () => {
    expect(generateMinutesFromAgenda([{ id: "1", heading: "  ", points: [] }])).toBe("");
  });

  it("numbers sections/points and trims whitespace", () => {
    const out = generateMinutesFromAgenda([
      { id: "1", heading: " Budget ", points: [{ id: "p", text: " Q1 review " }] },
    ]);
    expect(out).toContain("1. BUDGET");
    expect(out).toContain("1.1 Q1 review");
  });
});

describe("cleanAgendaSections", () => {
  it("drops empty points and empty sections, keeps at least one section", () => {
    const cleaned = cleanAgendaSections([
      { id: "1", heading: "", points: [{ id: "p1", text: "  " }] },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].heading).toBe("");
  });

  it("keeps a section with only a heading", () => {
    const cleaned = cleanAgendaSections([{ id: "1", heading: "Intro", points: [] }]);
    expect(cleaned).toEqual([{ id: "1", heading: "Intro", points: [] }]);
  });
});

describe("getRecurringSeriesIdFromAgenda", () => {
  it("returns null for missing/invalid input", () => {
    expect(getRecurringSeriesIdFromAgenda(null)).toBeNull();
    expect(getRecurringSeriesIdFromAgenda("{bad json")).toBeNull();
  });

  it("extracts the id from a JSON string payload", () => {
    expect(getRecurringSeriesIdFromAgenda(JSON.stringify({ recurringSeriesId: "s1" }))).toBe("s1");
  });

  it("extracts the id from an already-parsed object", () => {
    expect(getRecurringSeriesIdFromAgenda({ recurringSeriesId: "s2" })).toBe("s2");
  });
});
