import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { Textarea } from "@/components/ui/textarea";

export function NotesWidget({ widget, updateSettings }: DashboardWidgetRenderProps) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Textarea
        value={widget.settings?.notes || ""}
        placeholder="Keep a quiet scratchpad for the day."
        className="min-h-[160px] flex-1 resize-none bg-background/70"
        onChange={(event) => updateSettings({ notes: event.target.value })}
      />
      <p className="text-xs font-semibold text-muted-foreground">
        Auto-saves with your dashboard layout.
      </p>
    </div>
  );
}
