// Shared shape + row-mapping for recurring meeting series, used by both the
// list page and the series detail page so the DB<->UI mapping and the minutes
// generator live in exactly one place instead of two drifting copies.

export type AgendaPoint = {
  text: string;
};

export type AgendaSection = {
  heading: string;
  points: AgendaPoint[];
};

export type RecurringMeeting = {
  id: string;
  title: string;
  frequency: "Weekly" | "Monthly";
  startDate: string;
  meetingTime: string;
  location: string;
  occurrences: number;
  regularAttendees: string[];
  regularAgenda: AgendaSection[];
  peopleGroupId?: string;
  peopleGroupName?: string;
  peopleGroupMemberIds?: string[];
};

export const fromRecurringMeetingRow = (row: any): RecurringMeeting => ({
  id: row.id,
  title: row.title,
  frequency: row.frequency === "Monthly" ? "Monthly" : "Weekly",
  startDate: row.start_date || "",
  meetingTime: row.meeting_time || "",
  location: row.location || "",
  occurrences: row.occurrences || 12,
  regularAttendees: row.regular_attendees || [],
  regularAgenda: row.regular_agenda || [],
  peopleGroupId: row.people_group_id || undefined,
  peopleGroupName: row.people_group_name || undefined,
  peopleGroupMemberIds: row.people_group_member_ids || [],
});

export const toRecurringMeetingInsert = (input: {
  workspaceId: string;
  userId: string;
  title: string;
  frequency: "Weekly" | "Monthly";
  startDate: string;
  meetingTime: string;
  location: string;
  occurrences: number;
  regularAttendees: string[];
  regularAgenda: AgendaSection[];
  peopleGroupId?: string;
  peopleGroupName?: string;
  peopleGroupMemberIds?: string[];
}) => ({
  workspace_id: input.workspaceId,
  user_id: input.userId,
  title: input.title,
  frequency: input.frequency,
  start_date: input.startDate || null,
  meeting_time: input.meetingTime || null,
  location: input.location,
  occurrences: input.occurrences,
  regular_attendees: input.regularAttendees,
  regular_agenda: input.regularAgenda,
  people_group_id: input.peopleGroupId || null,
  people_group_name: input.peopleGroupName || null,
  people_group_member_ids: input.peopleGroupMemberIds || [],
});

const FIELD_TO_COLUMN: Partial<Record<keyof RecurringMeeting, string>> = {
  title: "title",
  frequency: "frequency",
  startDate: "start_date",
  meetingTime: "meeting_time",
  location: "location",
  occurrences: "occurrences",
  regularAttendees: "regular_attendees",
  regularAgenda: "regular_agenda",
  peopleGroupId: "people_group_id",
  peopleGroupName: "people_group_name",
  peopleGroupMemberIds: "people_group_member_ids",
};

/**
 * Maps a partial RecurringMeeting patch onto its DB column names, so callers
 * only ever name one field once instead of hand-writing a parallel
 * camelCase<->snake_case update object per call site.
 */
export const toRecurringMeetingPatch = (patch: Partial<RecurringMeeting>) => {
  const dbPatch: Record<string, unknown> = {};

  for (const key of Object.keys(patch) as (keyof RecurringMeeting)[]) {
    const column = FIELD_TO_COLUMN[key];
    if (column) dbPatch[column] = patch[key];
  }

  return dbPatch;
};

export const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

export const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export type SeriesOccurrence = {
  index: number;
  number: number;
  date: string;
};

export const buildOccurrences = (series: {
  startDate?: string;
  frequency: "Weekly" | "Monthly";
  occurrences?: number;
}): SeriesOccurrence[] => {
  if (!series.startDate) return [];

  const start = new Date(series.startDate + "T00:00:00");

  return Array.from({ length: series.occurrences || 12 }, (_, index) => {
    const date =
      series.frequency === "Weekly"
        ? new Date(start.getTime() + index * 7 * 24 * 60 * 60 * 1000)
        : addMonths(start, index);

    return {
      index,
      number: index + 1,
      date: toDateInputValue(date),
    };
  });
};

export const generateMinutesFromAgenda = (agenda: AgendaSection[] = []) => {
  return agenda
    .filter((section) => section.heading.trim() || section.points.length)
    .map((section, sectionIndex) => {
      const sectionNumber = sectionIndex + 1;
      const title = (section.heading || "Untitled Section").toUpperCase();

      const points = section.points
        .filter((point) => point.text.trim())
        .map((point, pointIndex) => {
          return `${sectionNumber}.${pointIndex + 1} ${point.text}\n\nNotes:\nDecisions:\n`;
        })
        .join("\n");

      return `${sectionNumber}. ${title}\n\n${points}`;
    })
    .join("\n\n");
};

/**
 * Tells the sidebar's series list to reload. The sidebar can't see this page's
 * state, and nothing dispatched this event after the move to Supabase, so a
 * freshly created series stayed missing from the nav until a full remount.
 */
export const notifyRecurringMeetingsChanged = () => {
  window.dispatchEvent(new Event("actsix-recurring-meetings-updated"));
};
