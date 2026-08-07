// Pure agenda helpers for the single-meeting agenda editor - parsing the
// stored JSON payload, cleaning drafts, serializing back, and generating a
// minutes skeleton from an agenda. No React, no Supabase: safe to unit test
// and safe to import from anywhere in the module.

export type AgendaPoint = {
  id: string;
  text: string;
};

export type AgendaSection = {
  id: string;
  heading: string;
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
});

export const makeAgendaSection = (): AgendaSection => ({
  id: crypto.randomUUID(),
  heading: "",
  points: [makeAgendaPoint()],
});

export const cleanNameList = (items: string[]) =>
  items.map((item) => item.trim()).filter(Boolean);

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
          ? parsed.sections.map((section: any) => ({
              id: section.id || crypto.randomUUID(),
              heading: section.heading || "",
              points:
                Array.isArray(section.points) && section.points.length
                  ? section.points.map((point: any) => ({
                      id: point.id || crypto.randomUUID(),
                      text: typeof point === "string" ? point : point.text || "",
                    }))
                  : [makeAgendaPoint()],
            }))
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
        points: lines.length
          ? lines.map((line) => ({ id: crypto.randomUUID(), text: line }))
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
      points: section.points,
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
      points: section.points.map((point) => ({ ...point, text: point.text.trim() })).filter((point) => point.text),
    }))
    .filter((section) => section.heading || section.points.length);

  if (!cleanSections.length) return "";

  return cleanSections
    .map((section, sectionIndex) => {
      const sectionNumber = sectionIndex + 1;
      const title = (section.heading || "Untitled Section").toUpperCase();

      const points = section.points
        .map((point, pointIndex) => `${sectionNumber}.${pointIndex + 1} ${point.text}\nNotes:\nDecisions:`)
        .join("\n\n");

      return points ? `${sectionNumber}. ${title}\n${points}` : `${sectionNumber}. ${title}`;
    })
    .join("\n\n");
};

export const cleanAgendaSections = (sections: AgendaSection[]) => {
  const cleaned = sections
    .map((section) => ({
      ...section,
      heading: section.heading.trim(),
      points: section.points
        .map((point) => ({ ...point, text: point.text.trim() }))
        .filter((point) => point.text),
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
