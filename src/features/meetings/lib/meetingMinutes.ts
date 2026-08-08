// Pure rendering/sanitizing helpers for the meeting minutes rich-text
// editor. Split out from MeetingDetailPage so the sanitization logic (the
// part that actually matters for security) sits somewhere reviewable on
// its own instead of buried in a 2,000-line component.

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const sanitizeMinutesHtml = (value: string) =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");

export const renderMinutesHtml = (notes?: string | null) => {
  if (!notes) return "";

  if (/<\/?[a-z][\s\S]*>/i.test(notes)) {
    return sanitizeMinutesHtml(notes);
  }

  // How deep the last numbered line was, so the bare "Notes:"/"Decisions:"
  // scaffolding lines that follow it can be indented to match. Without this
  // they render flush left, and a sub-point's notes read as though they belong
  // to its parent point.
  let depth: 0 | 1 | 2 = 0;

  return notes
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line);

      const labelMatch = line.match(/^(Notes|Decisions):(.*)$/);
      if (labelMatch) {
        return `<div class="minutes-note-label${
          depth === 2 ? " minutes-note-label-sub" : ""
        }">${escapeHtml(labelMatch[1])}:${escapeHtml(labelMatch[2])}</div>`;
      }

      if (/^\d+\.\s+/.test(line)) {
        depth = 0;
      } else if (/^\d+\.\d+\.\d+\s+/.test(line)) {
        depth = 2;
      } else if (/^\d+\.\d+\s+/.test(line)) {
        depth = 1;
      }

      if (/^\d+\.\s+/.test(line)) {
        // A trailing " (tag)" - "1. WORD OF ENCOURAGEMENT (Allan)" - keeps
        // its own case; the section-heading class uppercases everything via
        // CSS, so the tag needs its own span to opt back out.
        const headingMatch = line.match(/^(.*?)(\s\([^()]*\))?$/);
        const mainText = headingMatch?.[1] ?? line;
        const tagText = headingMatch?.[2]?.trim() ?? "";

        return `<div class="minutes-section-heading">${escapeHtml(mainText).toUpperCase()}${
          tagText ? ` <span class="minutes-section-tag">${escapeHtml(tagText)}</span>` : ""
        }</div>`;
      }

      const subtitleMatch = line.match(/^_(.+)_$/);
      if (subtitleMatch) {
        return `<div class="minutes-subtitle">${escapeHtml(subtitleMatch[1])}</div>`;
      }

      if (/^\d+\.\d+\.\d+\s+/.test(line)) {
        return `<div class="minutes-agenda-subpoint">${escaped}</div>`;
      }

      if (/^\d+\.\d+\s+/.test(line)) {
        return `<div class="minutes-agenda-point">${escaped}</div>`;
      }

      if (line.trim() === "") {
        return `<div class="minutes-blank-line"><br /></div>`;
      }

      return `<div>${escaped}</div>`;
    })
    .join("");
};

/**
 * True when the stored notes hold something a person actually wrote, rather
 * than the empty markup a contentEditable leaves behind (`<div><br></div>`).
 * Refilling minutes from the agenda overwrites notes wholesale, so this is the
 * guard that decides whether doing so would destroy real work.
 */
export const hasMinutesContent = (notes?: string | null) =>
  Boolean(
    notes &&
      notes
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .trim()
  );

export const getMinutesDocumentHtml = (element: HTMLDivElement | null) => {
  if (!element) return "";

  return sanitizeMinutesHtml(element.innerHTML).trim();
};
