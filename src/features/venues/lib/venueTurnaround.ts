import type { VenueBooking } from "@/features/venues/lib/venueBookings";

export type VenueWalkthroughPhase = "Before" | "After";

export type VenueWalkthrough = {
  id: string;
  workspace_id: string;
  hire_id: string;
  user_id: string;
  /** Null for the whole site rather than one room. */
  space_id: string | null;
  phase: VenueWalkthroughPhase;
  condition_notes: string;
  photo_urls: string[];
  walked_by: string;
  walked_at: string;
  created_at: string;
  updated_at: string;
};

export type VenueTurnaroundKind = "Cleaning" | "Turnaround" | "Repair";

export type VenueTurnaroundTask = {
  id: string;
  workspace_id: string;
  hire_id: string;
  user_id: string;
  space_id: string | null;
  title: string;
  kind: VenueTurnaroundKind;
  notes: string;
  /** Null for "before the next service, whenever". */
  starts_at: string | null;
  ends_at: string | null;
  done: boolean;
  done_at: string | null;
  done_by: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const VENUE_TURNAROUND_KINDS: VenueTurnaroundKind[] = [
  "Cleaning",
  "Turnaround",
  "Repair",
];

export type TurnaroundProgress = {
  done: number;
  total: number;
  /** False when there is nothing on the list - an empty list is not a finished one. */
  allDone: boolean;
};

export const turnaroundProgress = (tasks: VenueTurnaroundTask[]): TurnaroundProgress => {
  const done = tasks.filter((task) => task.done).length;
  return { done, total: tasks.length, allDone: tasks.length > 0 && done === tasks.length };
};

/**
 * Bookings that still have the room while this task is meant to happen.
 *
 * This is what "a cleaning schedule that respects in-use spaces" comes down to:
 * you cannot mop a hall somebody is still sitting in. Same half-open interval
 * as `findConflicts`, so cleaning that starts exactly when a booking ends is
 * fine, which is the normal case.
 *
 * A task with no window cannot be checked, and a task on the whole site is not
 * checked either - it has no room to be blocked from. Both return empty.
 */
export const blockingBookings = (
  task: Pick<VenueTurnaroundTask, "space_id" | "starts_at" | "ends_at" | "done">,
  bookings: VenueBooking[]
): VenueBooking[] => {
  if (task.done) return [];
  if (!task.starts_at || !task.ends_at || !task.space_id) return [];

  const start = new Date(task.starts_at).getTime();
  const end = new Date(task.ends_at).getTime();

  return bookings.filter((booking) => {
    if (booking.space_id !== task.space_id) return false;
    if (booking.status === "Cancelled") return false;

    return (
      new Date(booking.starts_at).getTime() < end && new Date(booking.ends_at).getTime() > start
    );
  });
};

/**
 * Open tasks first, because the list exists to show what is left. Within each
 * group: timed work in time order, undated work after it in its own order.
 */
export const sortTurnaroundTasks = (tasks: VenueTurnaroundTask[]): VenueTurnaroundTask[] =>
  [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;

    if (a.starts_at && b.starts_at) {
      const gap = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      if (gap !== 0) return gap;
    } else if (a.starts_at !== b.starts_at) {
      return a.starts_at ? -1 : 1;
    }

    return a.sort_order - b.sort_order;
  });

export type WalkthroughCoverage = {
  before: VenueWalkthrough[];
  after: VenueWalkthrough[];
  /**
   * True once both ends exist. A bond argument needs a before and an after -
   * either alone proves nothing about what changed.
   */
  bothEndsCaptured: boolean;
  photoCount: number;
};

export const walkthroughCoverage = (rows: VenueWalkthrough[]): WalkthroughCoverage => {
  const before = rows.filter((row) => row.phase === "Before");
  const after = rows.filter((row) => row.phase === "After");

  return {
    before,
    after,
    bothEndsCaptured: before.length > 0 && after.length > 0,
    photoCount: rows.reduce((total, row) => total + row.photo_urls.length, 0),
  };
};
