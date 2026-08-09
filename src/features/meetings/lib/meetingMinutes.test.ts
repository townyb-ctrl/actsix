import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  sanitizeMinutesHtml,
  renderMinutesHtml,
  hasMinutesContent,
  mergeGeneratedMinutes,
} from "./meetingMinutes";

describe("escapeHtml", () => {
  it("escapes angle brackets and ampersands", () => {
    expect(escapeHtml("<b>A & B</b>")).toBe("&lt;b&gt;A &amp; B&lt;/b&gt;");
  });
});

describe("sanitizeMinutesHtml", () => {
  it("strips script tags", () => {
    expect(sanitizeMinutesHtml('<p>hi</p><script>alert(1)</script>')).toBe("<p>hi</p>");
  });

  it("strips inline event handlers with double or single quotes", () => {
    expect(sanitizeMinutesHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
    expect(sanitizeMinutesHtml("<img src='x' onerror='alert(1)'>")).toBe("<img src='x'>");
  });

  it("strips javascript: protocol", () => {
    expect(sanitizeMinutesHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a href="alert(1)">x</a>');
  });
});

describe("hasMinutesContent", () => {
  it("is false for nothing, and for the empty markup a contentEditable leaves behind", () => {
    expect(hasMinutesContent(null)).toBe(false);
    expect(hasMinutesContent(undefined)).toBe(false);
    expect(hasMinutesContent("")).toBe(false);
    expect(hasMinutesContent("   ")).toBe(false);
    expect(hasMinutesContent("<div><br /></div>")).toBe(false);
    expect(hasMinutesContent("<div>&nbsp;</div>")).toBe(false);
  });

  it("is true once a person has written something", () => {
    expect(hasMinutesContent("<div>Agreed to fund the youth trip.</div>")).toBe(true);
    expect(hasMinutesContent("plain text minutes")).toBe(true);
  });
});

describe("mergeGeneratedMinutes", () => {
  const skeleton = [
    "1. OFFICE ADMIN",
    "1.1 Venue hire",
    "Notes:",
    "Decisions:",
    "1.1.1 Timings",
    "Notes:",
    "Decisions:",
  ].join("\n");

  it("files each block under the point it belongs to", () => {
    const out = mergeGeneratedMinutes(skeleton, "raw draft", [
      { point: "1.1", notes: "Quoted at R4,500 for the hall.", decisions: "Approved." },
      { point: "1.1.1", notes: "Doors at 08:00.", decisions: "" },
    ]);

    expect(out).toContain("Notes: <span class=\"minutes-note-text\">Quoted at R4,500 for the hall.</span>");
    expect(out).toContain("Decisions: <span class=\"minutes-note-text\">Approved.</span>");
    expect(out).toContain("Notes: <span class=\"minutes-note-text\">Doors at 08:00.</span>");
    // The sub-point had no decision, so its label is left blank to write in.
    expect(out).toContain('minutes-note-label-sub">Decisions:</div>');
    // The raw draft is not also dumped at the bottom.
    expect(out).not.toContain("raw draft");
  });

  it("never overwrites what a person already typed - the AI's version goes at the end instead", () => {
    const typed = "1. OFFICE ADMIN\n1.1 Venue hire\nNotes: Mine, thanks.\nDecisions:";
    const out = mergeGeneratedMinutes(typed, "", [{ point: "1.1", notes: "AI version.", decisions: "" }]);

    expect(out).toContain("Notes: Mine, thanks.");
    expect(out.indexOf("Mine, thanks.")).toBeLessThan(out.indexOf("AI version."));
  });

  it("appends writing that matches no point in the document rather than losing it", () => {
    const out = mergeGeneratedMinutes(skeleton, "", [{ point: "9.9", notes: "Raised under general.", decisions: "" }]);
    expect(out).toContain("Raised under general.");
  });

  it("falls back to appending the draft when nothing is keyed to a point", () => {
    expect(mergeGeneratedMinutes(skeleton, "1. AOB", [])).toContain("AOB");
    expect(mergeGeneratedMinutes("", "1. AOB", [])).toContain("AOB");
  });

  it("escapes generated text", () => {
    const out = mergeGeneratedMinutes(skeleton, "", [
      { point: "1.1", notes: "<script>evil()</script>", decisions: "" },
    ]);
    expect(out).not.toContain("<script>");
  });
});

describe("renderMinutesHtml", () => {
  it("returns empty string for no notes", () => {
    expect(renderMinutesHtml(null)).toBe("");
    expect(renderMinutesHtml(undefined)).toBe("");
  });

  it("sanitizes and passes through content that already looks like HTML", () => {
    expect(renderMinutesHtml('<p>hi</p><script>bad()</script>')).toBe("<p>hi</p>");
  });

  it("escapes and wraps plain-text section headings and points", () => {
    const out = renderMinutesHtml("1. BUDGET\n1.1 Discuss Q1\n\nFree text");
    expect(out).toContain('class="minutes-section-heading"');
    expect(out).toContain('class="minutes-agenda-point"');
    expect(out).toContain('class="minutes-blank-line"');
    expect(out).toContain("Free text");
  });

  it("uppercases the heading but keeps a trailing tag's own case, in its own span", () => {
    const out = renderMinutesHtml("1. WORD OF ENCOURAGEMENT (Allan)");
    expect(out).toContain("WORD OF ENCOURAGEMENT");
    expect(out).toContain('<span class="minutes-section-tag">(Allan)</span>');
    expect(out).not.toContain("(ALLAN)");
  });

  it("gives a point's number and its owner initials their own spans", () => {
    const out = renderMinutesHtml("2.1 Sound desk [RG]");

    expect(out).toContain('<span class="minutes-point-number">2.1</span>');
    expect(out).toContain('<span class="minutes-owner">RG</span>');
    // The brackets were scaffolding for the chip - they never reach the page.
    expect(out).not.toContain("[RG]");
  });

  it("chips an owner on a bullet line too, which carries no number", () => {
    const out = renderMinutesHtml("\u2022 Offices close at noon [BT]");

    expect(out).toContain('<span class="minutes-owner">BT</span>');
    expect(out).not.toContain("minutes-point-number");
  });

  it("escapes HTML-special characters in plain-text lines", () => {
    expect(renderMinutesHtml("<script>evil()</script>")).not.toContain("<script>");
  });

  it("styles a three-level line as a sub-point, distinct from a two-level point", () => {
    const out = renderMinutesHtml("1. OFFICE ADMIN\n1.1 IFBB Venue Hire\n1.1.1 Timings");
    expect(out).toContain('class="minutes-agenda-point"');
    expect(out).toContain('class="minutes-agenda-subpoint"');
  });

  it("indents Notes:/Decisions: to the depth of the point they belong to", () => {
    const out = renderMinutesHtml(
      "1. OFFICE ADMIN\n1.1 Venue hire\nNotes:\nDecisions:\n1.1.1 Timings\nNotes:\nDecisions:"
    );

    // The point's own labels sit at point depth; the sub-point's carry the
    // deeper class, so they no longer read as belonging to the parent.
    expect(out).toContain('<div class="minutes-note-label">Notes:</div>');
    expect(out).toContain('<div class="minutes-note-label minutes-note-label-sub">Notes:</div>');
    expect(out).toContain('<div class="minutes-note-label minutes-note-label-sub">Decisions:</div>');
  });

  it("resets label depth at the next section heading", () => {
    const out = renderMinutesHtml("1. A\n1.1.1 Deep\nNotes:\n2. B\nNotes:");
    // The second "Notes:" follows a heading, not a sub-point - it must not
    // inherit the previous section's indent.
    expect(out.split("minutes-note-label-sub").length - 1).toBe(1);
  });

  it("renders an underscore-wrapped line as an italic subtitle, without the underscores", () => {
    const out = renderMinutesHtml("1. WEEKEND FEEDBACK\n_Wins, Challenges, Changes_");
    expect(out).toContain('class="minutes-subtitle"');
    expect(out).toContain("Wins, Challenges, Changes");
    expect(out).not.toContain("_Wins");
  });
});
