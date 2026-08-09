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
      [{ id: "a", heading: "Budget", subtitle: "", layout: "list", points: [{ id: "p1", text: "Q1", date: "", ownerId: "", ownerName: "", children: [] }] }],
      ["Jane"]
    );
    const payload = parseAgendaPayload(stored);
    expect(payload.sections).toEqual([
      { id: "a", heading: "Budget", subtitle: "", layout: "list", points: [{ id: "p1", text: "Q1", date: "", ownerId: "", ownerName: "", children: [] }] },
    ]);
    expect(payload.apologies).toEqual(["Jane"]);
  });

  it("falls back to a single 'Agenda' section for legacy plain text", () => {
    const payload = parseAgendaPayload("Discuss budget\nApprove minutes");
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].heading).toBe("Agenda");
    expect(payload.sections[0].layout).toBe("list");
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

  it("parses layout, subheading, and one level of nested children", () => {
    const stored = JSON.stringify({
      type: "actsix-agenda-v1",
      sections: [
        {
          id: "s1",
          heading: "Office Admin",
          subtitle: "Wins, Challenges, Changes",
          layout: "list",
          points: [
            {
              id: "p1",
              text: "IFBB Venue Hire",
              children: [{ id: "c1", text: "Timings" }],
            },
          ],
        },
      ],
    });

    const payload = parseAgendaPayload(stored);
    const section = payload.sections[0];

    expect(section.subtitle).toBe("Wins, Challenges, Changes");
    expect(section.layout).toBe("list");
    expect(section.points[0].children).toEqual([{ id: "c1", text: "Timings", date: "", ownerId: "", ownerName: "", children: [] }]);
  });

  it("defaults layout to 'list' and drops a grandchild's own children", () => {
    const stored = JSON.stringify({
      type: "actsix-agenda-v1",
      sections: [
        {
          id: "s1",
          heading: "No layout set",
          points: [{ id: "p1", text: "Point", children: [{ id: "c1", text: "Child", children: [{ id: "g1", text: "Grandchild" }] }] }],
        },
      ],
    });

    const payload = parseAgendaPayload(stored);
    expect(payload.sections[0].layout).toBe("list");
    expect(payload.sections[0].points[0].children[0].children).toEqual([]);
  });

  it("rejects an unrecognized layout value and falls back to 'list'", () => {
    const stored = JSON.stringify({
      type: "actsix-agenda-v1",
      sections: [{ id: "s1", heading: "Weird", layout: "grid", points: [] }],
    });

    expect(parseAgendaPayload(stored).sections[0].layout).toBe("list");
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
    expect(generateMinutesFromAgenda([{ id: "1", heading: "  ", subtitle: "", layout: "list", points: [] }])).toBe("");
  });

  it("numbers sections/points and trims whitespace", () => {
    const out = generateMinutesFromAgenda([
      { id: "1", heading: " Budget ", subtitle: "", layout: "list", points: [{ id: "p", text: " Q1 review ", date: "", ownerId: "", ownerName: "", children: [] }] },
    ]);
    expect(out).toContain("1. BUDGET");
    expect(out).toContain("1.1 Q1 review");
  });

  it("puts an owner's initials beside their point", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "Budget",
        subtitle: "",
        layout: "list",
        points: [{ id: "p", text: "Q1 review", date: "", ownerId: "person-1", ownerName: "Rencia Green", children: [] }],
      },
    ]);
    expect(out).toContain("1.1 Q1 review [RG]");
  });

  it("writes a Text section as plain lines - no bullet, number or discussion space", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "Notice",
        subtitle: "",
        layout: "text",
        points: [{ id: "p", text: "Offices close at noon on Friday.", date: "", ownerId: "", ownerName: "", children: [] }],
      },
    ]);
    expect(out).toBe("1. NOTICE\nOffices close at noon on Friday.");
  });

  it("numbers a nested child one level deeper than its parent point", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "Office Admin",
        subtitle: "",
        layout: "list",
        points: [
          {
            id: "p1",
            text: "IFBB Venue Hire",
            date: "",
            ownerId: "", ownerName: "", children: [{ id: "c1", text: "Timings", date: "", ownerId: "", ownerName: "", children: [] }],
          },
        ],
      },
    ]);

    expect(out).toContain("1.1 IFBB Venue Hire");
    expect(out).toContain("1.1.1 Timings");
  });

  it("renders the subheading in italics markup under the heading", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "Word Of Encouragement",
        subtitle: "Wins, Challenges, Changes",
        layout: "list",
        points: [],
      },
    ]);

    expect(out).toContain("1. WORD OF ENCOURAGEMENT");
    expect(out).toContain("_Wins, Challenges, Changes_");
  });

  it("renders a dated-layout section as bullet + date, with no Notes/Decisions blanks", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "What's Next",
        subtitle: "",
        layout: "dated",
        points: [{ id: "p1", text: "Link Ladies", date: "2026-08-06", ownerId: "", ownerName: "", children: [] }],
      },
    ]);

    expect(out).toContain("Link Ladies");
    expect(out).not.toContain("Notes:");
    expect(out).not.toContain("1.1");
  });

  it("renders a boxed-layout section as a plain bullet list, with no Notes/Decisions blanks", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "Announcers List",
        subtitle: "",
        layout: "boxed",
        points: [{ id: "p1", text: "Sam vH", date: "", ownerId: "", ownerName: "", children: [] }],
      },
    ]);

    expect(out).toContain("Sam vH");
    expect(out).not.toContain("Notes:");
  });

  it("keeps a dated point's children in the output instead of dropping them", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "What's Next",
        subtitle: "",
        layout: "dated",
        points: [
          {
            id: "p1",
            text: "IFBB Venue Hire",
            date: "2026-08-19",
            ownerId: "", ownerName: "", children: [{ id: "c1", text: "Affected: Worship & Linkway Men", date: "", ownerId: "", ownerName: "", children: [] }],
          },
        ],
      },
    ]);

    expect(out).toContain("IFBB Venue Hire");
    expect(out).toContain("Affected: Worship & Linkway Men");
  });
});

describe("cleanAgendaSections", () => {
  it("drops empty points and empty sections, keeps at least one section", () => {
    const cleaned = cleanAgendaSections([
      { id: "1", heading: "", subtitle: "", layout: "list", points: [{ id: "p1", text: "  ", date: "", ownerId: "", ownerName: "", children: [] }] },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].heading).toBe("");
  });

  it("keeps a section with only a subheading, no heading and no points", () => {
    const cleaned = cleanAgendaSections([
      { id: "1", heading: "", subtitle: "Wins", layout: "list", points: [] },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].subtitle).toBe("Wins");
  });

  it("keeps a section with only a heading", () => {
    const cleaned = cleanAgendaSections([{ id: "1", heading: "Intro", subtitle: "", layout: "list", points: [] }]);
    expect(cleaned).toEqual([{ id: "1", heading: "Intro", subtitle: "", layout: "list", points: [] }]);
  });

  it("trims the subheading and drops empty children", () => {
    const cleaned = cleanAgendaSections([
      {
        id: "1",
        heading: "Intro",
        subtitle: "  Wins  ",
        layout: "list",
        points: [{ id: "p1", text: "Point", date: "", ownerId: "", ownerName: "", children: [{ id: "c1", text: "  ", date: "", ownerId: "", ownerName: "", children: [] }] }],
      },
    ]);

    expect(cleaned[0].subtitle).toBe("Wins");
    expect(cleaned[0].points[0].children).toEqual([]);
  });

  it("keeps a point that has children but no text of its own", () => {
    const cleaned = cleanAgendaSections([
      {
        id: "1",
        heading: "Intro",
        subtitle: "",
        layout: "list",
        points: [{ id: "p1", text: "  ", date: "", ownerId: "", ownerName: "", children: [{ id: "c1", text: "Child", date: "", ownerId: "", ownerName: "", children: [] }] }],
      },
    ]);

    expect(cleaned[0].points).toHaveLength(1);
    expect(cleaned[0].points[0].children).toHaveLength(1);
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
