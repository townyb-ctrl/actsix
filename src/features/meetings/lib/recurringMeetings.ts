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
