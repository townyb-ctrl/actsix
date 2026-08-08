import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  sanitizeMinutesHtml,
  renderMinutesHtml,
  hasMinutesContent,
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
