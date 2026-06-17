import { supabase } from "@/integrations/supabase/client";
import {
  calculateNextDueDate,
  getTemplateNextDueDate,
  recurrenceHasEnded,
} from "@/features/tasks/lib/recurringTaskDates";
import type { RecurringTaskTemplate } from "@/features/tasks/types/recurringTasks";

export const createTaskInstanceFromTemplate = async (
  template: RecurringTaskTemplate,
  dueDate = getTemplateNextDueDate(template)
) => {
  const occurrenceNumber = template.generated_count + 1;

  const { data, error } = await (supabase as any)
    .from("tasks")
    .insert({
      id: crypto.randomUUID(),
      title: template.title,
      notes: template.description || "",
      project: template.project || "",
      project_id: template.project_id,
      context: template.context || "General",
      priority: template.priority || "Medium",
      energy: template.energy || "Medium",
      minutes: template.minutes || 15,
      due: dueDate,
      tags: Array.isArray(template.tags) ? template.tags : [],
      assigned_person_id: template.assigned_person_id,
      complete: false,
      recurring_template_id: template.id,
      recurring_occurrence_number: occurrenceNumber,
      user_id: template.user_id,
    })
    .select("id")
    .single();

  if (error) throw error;

  const nextDueDate = calculateNextDueDate(dueDate, template.frequency, template.interval);
  const nextCount = template.generated_count + 1;
  const ended = recurrenceHasEnded({
    endCondition: template.end_condition,
    endDate: template.end_date,
    endAfterOccurrences: template.end_after_occurrences,
    generatedCount: nextCount,
    nextDueDate,
  });

  const { error: updateError } = await (supabase as any)
    .from("recurring_task_templates")
    .update({
      generated_count: nextCount,
      last_generated_task_id: data.id,
      next_due_date: ended ? null : nextDueDate,
      status: ended ? "ended" : template.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", template.id);

  if (updateError) throw updateError;

  return data;
};

export const createNextRecurringTaskOnCompletion = async (task: any) => {
  if (!task?.recurring_template_id || task.complete) return false;

  const { data, error } = await (supabase as any)
    .from("recurring_task_templates")
    .select("*")
    .eq("id", task.recurring_template_id)
    .single();

  if (error || !data) throw error;

  const template = data as RecurringTaskTemplate;

  if (template.status !== "active" || template.creation_mode !== "on_completion") {
    return false;
  }

  if (!template.next_due_date) return false;

  await createTaskInstanceFromTemplate(template);
  return true;
};
