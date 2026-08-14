export type VenueRunSheetItem = {
  id: string;
  workspace_id: string;
  hire_id: string;
  user_id: string;
  /** Null for something that belongs to the whole site rather than one room. */
  space_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  setup_notes: string;
  av_notes: string;
  access_notes: string;
  risk_notes: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RunSheetDay = {
  /** Local calendar day, as YYYY-MM-DD. */
  day: string;
  items: VenueRunSheetItem[];
};

const localDayKey = (iso: string) => {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * The run sheet as the day-by-day timeline staff actually read off.
 *
 * Within a day, items run in time order; two things starting at the same
 * moment fall back to sort_order, so a coordinator who has decided that the
 * briefing comes before the doors opening keeps that order.
 */
export const runSheetByDay = (items: VenueRunSheetItem[]): RunSheetDay[] => {
  const days = new Map<string, VenueRunSheetItem[]>();

  const ordered = [...items].sort((a, b) => {
    const byTime = a.starts_at.localeCompare(b.starts_at);
    if (byTime !== 0) return byTime;
    return a.sort_order - b.sort_order;
  });

  for (const item of ordered) {
    const key = localDayKey(item.starts_at);
    days.set(key, [...(days.get(key) ?? []), item]);
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayItems]) => ({ day, items: dayItems }));
};
