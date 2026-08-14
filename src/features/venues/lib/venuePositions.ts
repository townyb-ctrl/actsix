export type VenuePositionRole = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VenuePosition = {
  id: string;
  workspace_id: string;
  hire_id: string;
  user_id: string;
  role_id: string;
  starts_at: string;
  ends_at: string;
  /** How many people this slot needs. */
  needed: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type VenuePositionAssignment = {
  id: string;
  workspace_id: string;
  position_id: string;
  user_id: string;
  /** A directory person, or null for someone named by hand. */
  person_id: string | null;
  display_name: string;
  notes: string;
  created_at: string;
};

/** The little a position board needs to know about a person. */
export type PositionPerson = {
  id: string;
  display_name: string;
};

/** How many people this position is still short of. Never negative: over-filling a slot is allowed. */
export const unfilledCount = (
  position: VenuePosition,
  assignments: VenuePositionAssignment[]
): number => {
  const filled = assignments.filter((entry) => entry.position_id === position.id).length;
  return Math.max(0, position.needed - filled);
};

export type PositionDay = {
  /** Local calendar day, as YYYY-MM-DD. */
  day: string;
  positions: VenuePosition[];
};

const localDayKey = (iso: string) => {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Shifts grouped under the day they start, earliest first within each day. */
export const positionsByDay = (positions: VenuePosition[]): PositionDay[] => {
  const days = new Map<string, VenuePosition[]>();

  for (const position of [...positions].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const key = localDayKey(position.starts_at);
    days.set(key, [...(days.get(key) ?? []), position]);
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayPositions]) => ({ day, positions: dayPositions }));
};

/**
 * Who is filling a slot.
 *
 * A directory person's name wins, so a rename in People flows through. The
 * typed name is the fallback, which also covers a person deleted from the
 * directory after being assigned - the shift still shows who was on it.
 */
export const assignmentLabel = (
  assignment: VenuePositionAssignment,
  people: PositionPerson[]
): string => {
  if (assignment.person_id) {
    const person = people.find((candidate) => candidate.id === assignment.person_id);
    if (person) return person.display_name;
  }

  return assignment.display_name.trim() || "Unknown";
};
