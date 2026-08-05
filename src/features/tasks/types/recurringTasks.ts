export type RecurringFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type RecurringStatus = "active" | "paused" | "ended";
export type RecurringEndCondition = "never" | "on_date" | "after_occurrences";
// "ahead_of_time" existed in the type/DB but nothing ever generated tasks for
// it - only on_completion is wired up in recurringTasksApi.ts. Narrowed to
// the one mode that actually works; the column stays for existing rows.
export type RecurringCreationMode = "on_completion";

export type RecurringTaskTemplate = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  project: string;
  project_id: string | null;
  assigned_person_id: string | null;
  priority: string;
  context: string;
  energy: string;
  minutes: number;
  tags: string[];
  first_due_date: string;
  next_due_date: string | null;
  frequency: RecurringFrequency;
  interval: number;
  end_condition: RecurringEndCondition;
  end_date: string | null;
  end_after_occurrences: number | null;
  creation_mode: RecurringCreationMode;
  status: RecurringStatus;
  generated_count: number;
  last_generated_task_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringTemplateDraft = Omit<
  RecurringTaskTemplate,
  "id" | "user_id" | "generated_count" | "last_generated_task_id" | "created_at" | "updated_at"
>;
