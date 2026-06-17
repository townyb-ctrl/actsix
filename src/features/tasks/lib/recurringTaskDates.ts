import type {
  RecurringEndCondition,
  RecurringFrequency,
  RecurringTaskTemplate,
} from "@/features/tasks/types/recurringTasks";

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addMonthsClamped = (date: Date, months: number) => {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
};

export const calculateNextDueDate = (
  dueDate: string,
  frequency: RecurringFrequency,
  interval = 1
) => {
  const date = parseLocalDate(dueDate);
  const safeInterval = Math.max(1, Number(interval) || 1);

  if (frequency === "daily") date.setDate(date.getDate() + safeInterval);
  if (frequency === "weekly") date.setDate(date.getDate() + safeInterval * 7);
  if (frequency === "monthly") return formatLocalDate(addMonthsClamped(date, safeInterval));
  if (frequency === "quarterly") return formatLocalDate(addMonthsClamped(date, safeInterval * 3));
  if (frequency === "yearly") return formatLocalDate(addMonthsClamped(date, safeInterval * 12));

  return formatLocalDate(date);
};

export const recurrenceHasEnded = ({
  endCondition,
  endDate,
  endAfterOccurrences,
  generatedCount,
  nextDueDate,
}: {
  endCondition: RecurringEndCondition;
  endDate?: string | null;
  endAfterOccurrences?: number | null;
  generatedCount: number;
  nextDueDate?: string | null;
}) => {
  if (endCondition === "on_date" && endDate && nextDueDate) {
    return parseLocalDate(nextDueDate).getTime() > parseLocalDate(endDate).getTime();
  }

  if (endCondition === "after_occurrences" && endAfterOccurrences) {
    return generatedCount >= endAfterOccurrences;
  }

  return false;
};

export const getTemplateNextDueDate = (template: Pick<
  RecurringTaskTemplate,
  "next_due_date" | "first_due_date" | "frequency" | "interval"
>) => template.next_due_date || template.first_due_date;

export const formatFrequencyLabel = (frequency: RecurringFrequency, interval: number) => {
  const labels: Record<RecurringFrequency, string> = {
    daily: "day",
    weekly: "week",
    monthly: "month",
    quarterly: "quarter",
    yearly: "year",
  };
  const unit = labels[frequency];
  const safeInterval = Math.max(1, Number(interval) || 1);
  return safeInterval === 1 ? `Every ${unit}` : `Every ${safeInterval} ${unit}s`;
};
