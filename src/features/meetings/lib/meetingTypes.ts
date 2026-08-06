// Real types for the Meetings module's core rows, replacing the `any` typing
// that let a 2,470-line component drift with no compiler backstop.

export type Meeting = {
  id: string;
  user_id: string;
  title: string;
  meeting_date: string | null;
  meeting_time: string | null;
  location: string;
  type: string;
  status?: string;
  agenda: string | null;
  notes: string | null;
  attendees: string[] | null;
  google_meet_url: string | null;
  chairperson_id: string | null;
  minute_taker_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MeetingAction = {
  id: string;
  meeting_id: string;
  user_id: string;
  title: string;
  assignee: string | null;
  assigned_person_id: string | null;
  due: string | null;
  linked_project: string | null;
  status: string;
  created_at?: string;
};

export type MeetingPersonProfile = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
};

export type MeetingGroupSource = {
  id: string;
  group_id: string;
  people_groups: { id: string; name: string } | null;
};

export type MeetingFolderSource = {
  id: string;
  folder_id: string;
  people_group_folders: { id: string; name: string } | null;
};

export type PersonOption = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
};

export type GroupOption = { id: string; name: string };
export type FolderOption = { id: string; name: string };
