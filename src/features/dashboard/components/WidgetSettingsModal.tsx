import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  DashboardWidgetDefinition,
  DashboardWidgetSettings,
  UserDashboardWidget,
} from "@/features/dashboard/types/dashboardTypes";

type WidgetSettingsModalProps = {
  widget: UserDashboardWidget | null;
  definition?: DashboardWidgetDefinition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (widgetId: string, settings: DashboardWidgetSettings) => void;
};

export function WidgetSettingsModal({
  widget,
  definition,
  open,
  onOpenChange,
  onSave,
}: WidgetSettingsModalProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [itemLimit, setItemLimit] = useState("5");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!widget) return;

    setTitle(widget.settings?.title || "");
    setSubtitle(widget.settings?.subtitle || "");
    setItemLimit(String(widget.settings?.itemLimit || 5));
    setNotes(widget.settings?.notes || "");
  }, [widget]);

  const saveSettings = () => {
    if (!widget) return;

    onSave(widget.id, {
      title: title.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      itemLimit: Math.max(1, Math.min(12, Number(itemLimit) || 5)),
      notes,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Widget Settings</DialogTitle>
          <DialogDescription>
            Tune this widget without changing the rest of your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="widget-title">Custom title</Label>
            <Input
              id="widget-title"
              value={title}
              placeholder={definition?.title || "Widget title"}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="widget-subtitle">Custom subtitle</Label>
            <Input
              id="widget-subtitle"
              value={subtitle}
              placeholder={definition?.subtitle || "Optional context line"}
              onChange={(event) => setSubtitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="widget-limit">Items to show</Label>
            <Input
              id="widget-limit"
              type="number"
              min={1}
              max={12}
              value={itemLimit}
              onChange={(event) => setItemLimit(event.target.value)}
            />
          </div>

          {widget?.definitionId === "notes" && (
            <div className="space-y-2">
              <Label htmlFor="widget-notes">Scratchpad</Label>
              <Textarea
                id="widget-notes"
                value={notes}
                rows={6}
                placeholder="Keep a short note for your day."
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="actsix-btn-outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="actsix-btn-primary" onClick={saveSettings}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
