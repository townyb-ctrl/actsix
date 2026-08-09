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

/** The point number ("2.1", "2.1.3") leading a generated line, and the owner
 *  initials trailing it, are structure rather than writing - they get their own
 *  spans so the document can mute one and chip the other, leaving what someone
 *  actually typed as the darkest thing on the page. */
const decorateGeneratedLine = (escaped: string) =>
  escaped
    .replace(/^(\d+(?:\.\d+)+)(\s+)/, '<span class="minutes-point-number">$1</span>$2')
    .replace(/\s\[([^[\]]{1,4})\]\s*$/, ' <span class="minutes-owner">$1</span>');

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
        return `<div class="minutes-agenda-subpoint">${decorateGeneratedLine(escaped)}</div>`;
      }

      if (/^\d+\.\d+\s+/.test(line)) {
        return `<div class="minutes-agenda-point">${decorateGeneratedLine(escaped)}</div>`;
      }

      // Bullet and plain-text sections carry owners too, and nothing else about
      // their line is structural.
      if (/\s\[[^[\]]{1,4}\]\s*$/.test(line)) {
        return `<div>${decorateGeneratedLine(escaped)}</div>`;
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

export type GeneratedPointNote = { point: string; notes?: string; decisions?: string };

/**
 * Merge AI-drafted minutes into the minutes document. When the model keyed its
 * writing to agenda point numbers, each block lands under its own point's
 * "Notes:" / "Decisions:" line rather than being dumped at the bottom, which is
 * the only place it is any use when the minutes are read later. Anything typed
 * under a label already wins - a person's own words are never overwritten - and
 * anything that matches no point in the document is appended so it can't be
 * silently lost.
 */
export const mergeGeneratedMinutes = (
  existingNotes: string | null | undefined,
  generatedMinutes: string,
  pointNotes: GeneratedPointNote[] = []
) => {
  const base = renderMinutesHtml(existingNotes);
  const generated = generatedMinutes.trim();

  const usable = pointNotes.filter((entry) => entry.point?.trim() && (entry.notes?.trim() || entry.decisions?.trim()));
  if (!base || !usable.length) {
    return [base, renderMinutesHtml(generated)].filter(Boolean).join(`<div class="minutes-blank-line"><br /></div>`);
  }

  const doc = new DOMParser().parseFromString(`<body>${base}</body>`, "text/html");
  const placed = new Set<string>();
  let currentPoint = "";

  for (const element of Array.from(doc.body.children)) {
    const text = element.textContent || "";

    const pointMatch = text.match(/^(\d+(?:\.\d+)+)\s/);
    if (pointMatch) {
      currentPoint = pointMatch[1];
      continue;
    }

    const labelMatch = text.match(/^(Notes|Decisions):(.*)$/);
    if (!labelMatch || !currentPoint) continue;
    // Someone already wrote under this label - leave it alone.
    if (labelMatch[2].trim()) continue;

    const entry = usable.find((item) => item.point.trim() === currentPoint);
    const value = (labelMatch[1] === "Notes" ? entry?.notes : entry?.decisions)?.trim();
    if (!value) continue;

    element.innerHTML = `${labelMatch[1]}: <span class="minutes-note-text">${escapeHtml(value)}</span>`;
    placed.add(currentPoint);
  }

  const leftovers = usable
    .filter((entry) => !placed.has(entry.point.trim()))
    .map((entry) =>
      [
        `${entry.point.trim()} (from the recording)`,
        entry.notes?.trim() ? `Notes: ${entry.notes.trim()}` : "",
        entry.decisions?.trim() ? `Decisions: ${entry.decisions.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");

  return [doc.body.innerHTML, renderMinutesHtml(leftovers)]
    .filter(Boolean)
    .join(`<div class="minutes-blank-line"><br /></div>`);
};

export const getMinutesDocumentHtml = (element: HTMLDivElement | null) => {
  if (!element) return "";

  return sanitizeMinutesHtml(element.innerHTML).trim();
};
