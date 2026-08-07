// Pure agenda helpers for the single-meeting agenda editor - parsing the
// stored JSON payload, cleaning drafts, serializing back, and generating a
// minutes skeleton from an agenda. No React, no Supabase: safe to unit test
// and safe to import from anywhere in the module.

export type AgendaSectionLayout = "list" | "dated" | "boxed";

export type AgendaPoint = {
  id: string;
  text: string;
  /** Only meaningful when the owning section's layout is "dated". */
  date: string;
  /** One level only - a child point's own `children` is always kept empty,
   *  enforced here in parsing and by the editor UI not offering the control. */
  children: AgendaPoint[];
};

export type AgendaSection = {
  id: string;
  heading: string;
  /** Short tag rendered beside the heading, e.g. "(Allan)". Empty when unused. */
  tag: string;
  /** Italic line rendered under the heading. Empty when unused. */
  subtitle: string;
  /** Defaults to "list" - absent on every agenda stored before this field existed. */
  layout: AgendaSectionLayout;
  points: AgendaPoint[];
};

/** Carried in the agenda JSON so a meeting generated from a recurring series
 *  can still find its way back to that series after the agenda is edited. */
export type AgendaSeriesMeta = {
  recurringSeriesId?: string | null;
  peopleGroupId?: string | null;
  peopleGroupName?: string | null;
};

export type AgendaPayload = {
  type: "actsix-agenda-v1";
  sections: AgendaSection[];
  apologies?: string[];
};

export const getAgendaSeriesMeta = (
  agenda?: string | Record<string, unknown> | null
): AgendaSeriesMeta => {
  if (!agenda) return {};

  try {
    const parsed = typeof agenda === "string" ? JSON.parse(agenda) : agenda;

    return {
      recurringSeriesId: typeof parsed?.recurringSeriesId === "string" ? parsed.recurringSeriesId : null,
      peopleGroupId: typeof parsed?.peopleGroupId === "string" ? parsed.peopleGroupId : null,
      peopleGroupName: typeof parsed?.peopleGroupName === "string" ? parsed.peopleGroupName : null,
    };
  } catch {
    return {};
  }
};

export const makeAgendaPoint = (): AgendaPoint => ({
  id: crypto.randomUUID(),
  text: "",
  date: "",
  children: [],
});

export const makeAgendaSection = (): AgendaSection => ({
  id: crypto.randomUUID(),
  heading: "",
  tag: "",
  subtitle: "",
  layout: "list",
  points: [makeAgendaPoint()],
});

export const cleanNameList = (items: string[]) =>
  items.map((item) => item.trim()).filter(Boolean);

const AGENDA_SECTION_LAYOUTS: AgendaSectionLayout[] = ["list", "dated", "boxed"];

const parseAgendaChildPoint = (child: any): AgendaPoint => ({
  id: child?.id || crypto.randomUUID(),
  text: typeof child === "string" ? child : child?.text || "",
  date: typeof child?.date === "string" ? child.date : "",
  // A child's own children are always dropped - nesting is capped at one level.
  children: [],
});

const parseAgendaPoint = (point: any): AgendaPoint => ({
  id: point?.id || crypto.randomUUID(),
  text: typeof point === "string" ? point : point?.text || "",
  date: typeof point?.date === "string" ? point.date : "",
  children:
    typeof point === "object" && Array.isArray(point?.children)
      ? point.children.map(parseAgendaChildPoint)
      : [],
});

const parseAgendaSection = (section: any): AgendaSection => ({
  id: section.id || crypto.randomUUID(),
  heading: section.heading || "",
  tag: typeof section.tag === "string" ? section.tag : "",
  subtitle: typeof section.subtitle === "string" ? section.subtitle : "",
  layout: AGENDA_SECTION_LAYOUTS.includes(section.layout) ? section.layout : "list",
  points:
    Array.isArray(section.points) && section.points.length
      ? section.points.map(parseAgendaPoint)
      : [makeAgendaPoint()],
});

export const parseAgendaPayload = (value?: string | null): AgendaPayload => {
  if (!value) {
    return { type: "actsix-agenda-v1", sections: [makeAgendaSection()], apologies: [] };
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      parsed.type === "actsix-agenda-v1" &&
      Array.isArray(parsed.sections)
    ) {
      return {
        type: "actsix-agenda-v1",
        sections: parsed.sections.length
          ? parsed.sections.map(parseAgendaSection)
          : [makeAgendaSection()],
        apologies: Array.isArray(parsed.apologies) ? cleanNameList(parsed.apologies) : [],
      };
    }
  } catch {
    // Existing plain-text agendas are converted below.
  }

  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    type: "actsix-agenda-v1",
    sections: [
      {
        id: crypto.randomUUID(),
        heading: "Agenda",
        tag: "",
        subtitle: "",
        layout: "list",
        points: lines.length
          ? lines.map((line) => ({ id: crypto.randomUUID(), text: line, date: "", children: [] }))
          : [makeAgendaPoint()],
      },
    ],
    apologies: [],
  };
};

export const serializeAgenda = (
  sections: AgendaSection[],
  apologies: string[],
  seriesMeta?: AgendaSeriesMeta
) =>
  JSON.stringify({
    type: "actsix-agenda-v1",
    sections: sections.map((section) => ({
      id: section.id,
      heading: section.heading,
      tag: section.tag,
      subtitle: section.subtitle,
      layout: section.layout,
      points: section.points.map((point) => ({
        id: point.id,
        text: point.text,
        date: point.date,
        children: point.children.map((child) => ({
          id: child.id,
          text: child.text,
          date: child.date,
          children: [],
        })),
      })),
    })),
    apologies: cleanNameList(apologies),
    // Round-trip the series link instead of dropping it: without this, saving
    // the agenda on a meeting generated from a recurring series silently
    // detached it from that series (getRecurringSeriesIdFromAgenda would
    // return null on the very next load).
    ...(seriesMeta?.recurringSeriesId ? { recurringSeriesId: seriesMeta.recurringSeriesId } : {}),
    ...(seriesMeta?.peopleGroupId ? { peopleGroupId: seriesMeta.peopleGroupId } : {}),
    ...(seriesMeta?.peopleGroupName ? { peopleGroupName: seriesMeta.peopleGroupName } : {}),
  });

export const parseAttendees = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const formatDate = (date?: string | null) => {
  if (!date) return "No date";

  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const generateMinutesFromAgenda = (sections: AgendaSection[]) => {
  const cleanSections = sections
    .map((section) => ({
      ...section,
      heading: section.heading.trim(),
      tag: (section.tag || "").trim(),
      subtitle: (section.subtitle || "").trim(),
      points: section.points
        .map((point) => ({
          ...point,
          text: point.text.trim(),
          children: (point.children || [])
            .map((child) => ({ ...child, text: child.text.trim() }))
            .filter((child) => child.text),
        }))
        .filter((point) => point.text || point.children.length),
    }))
    .filter((section) => section.heading || section.points.length);

  if (!cleanSections.length) return "";

  return cleanSections
    .map((section, sectionIndex) => {
      const sectionNumber = sectionIndex + 1;
      const title = (section.heading || "Untitled Section").toUpperCase();
      const titleLine = `${sectionNumber}. ${title}${section.tag ? ` ${section.tag}` : ""}`;
      const subtitleLine = section.subtitle ? `_${section.subtitle}_` : "";

      let pointsBlock = "";

      if (section.layout === "dated") {
        pointsBlock = section.points
          .map((point) => `• ${point.text}${point.date ? ` — ${formatDate(point.date)}` : ""}`)
          .join("\n");
      } else if (section.layout === "boxed") {
        pointsBlock = section.points.map((point) => `• ${point.text}`).join("\n");
      } else {
        pointsBlock = section.points
          .map((point, pointIndex) => {
            const pointNumber = pointIndex + 1;
            const pointLine = `${sectionNumber}.${pointNumber} ${point.text}\nNotes:\nDecisions:`;
            const childLines = point.children
              .map(
                (child, childIndex) =>
                  `${sectionNumber}.${pointNumber}.${childIndex + 1} ${child.text}\nNotes:\nDecisions:`
              )
              .join("\n\n");

            return childLines ? `${pointLine}\n\n${childLines}` : pointLine;
          })
          .join("\n\n");
      }

      return [titleLine, subtitleLine, pointsBlock].filter(Boolean).join("\n");
    })
    .join("\n\n");
};

export const cleanAgendaSections = (sections: AgendaSection[]) => {
  const cleaned = sections
    .map((section) => ({
      ...section,
      heading: section.heading.trim(),
      tag: section.tag.trim(),
      subtitle: section.subtitle.trim(),
      points: section.points
        .map((point) => ({
          ...point,
          text: point.text.trim(),
          children: point.children
            .map((child) => ({ ...child, text: child.text.trim() }))
            .filter((child) => child.text),
        }))
        .filter((point) => point.text || point.children.length),
    }))
    .filter((section) => section.heading || section.points.length);

  return cleaned.length ? cleaned : [makeAgendaSection()];
};

export const getRecurringSeriesIdFromAgenda = (agenda?: string | Record<string, unknown> | null) => {
  if (!agenda) return null;

  try {
    const parsed = typeof agenda === "string" ? JSON.parse(agenda) : agenda;
    return typeof parsed?.recurringSeriesId === "string" ? parsed.recurringSeriesId : null;
  } catch {
    return null;
  }
};
