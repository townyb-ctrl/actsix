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

  return notes
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line);

      if (/^\d+\.\s+/.test(line)) {
        return `<div class="minutes-section-heading">${escaped.toUpperCase()}</div>`;
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
