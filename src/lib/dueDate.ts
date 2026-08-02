export type DueTone = "overdue" | "today" | "upcoming" | "none";

// A due date only deserves an alarm colour when it's actually urgent.
// Colouring every date the same coral makes none of them stand out.
export const getDueTone = (date?: string | null): DueTone => {
  if (!date) return "none";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(parsed);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  return "upcoming";
};

/** Pill treatment - border + fill + text. Used where the date stands alone. */
export const dueToneClass: Record<DueTone, string> = {
  overdue: "border-brand-coral/25 bg-brand-coral/10 text-brand-coral",
  today: "border-brand-amber/30 bg-brand-amber/10 text-brand-amber",
  upcoming: "border-border/70 bg-background/70 text-muted-foreground",
  none: "",
};

