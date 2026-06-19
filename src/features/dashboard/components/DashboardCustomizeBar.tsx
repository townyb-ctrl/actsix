import { Check, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardCustomizeBarProps = {
  savedState: "saved" | "saving";
  onAddWidget: () => void;
  onResetLayout: () => void;
  onDone: () => void;
};

export function DashboardCustomizeBar({
  savedState,
  onAddWidget,
  onResetLayout,
  onDone,
}: DashboardCustomizeBarProps) {
  return (
    <div className="sticky top-3 z-20 rounded-2xl border border-brand-teal/20 bg-card/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="label-eyebrow text-brand-teal">Customize Dashboard</p>
          <p className="text-sm font-semibold text-muted-foreground">
            Arrange calm ministry signals without overlapping cards or freeform canvas clutter.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-extrabold text-muted-foreground">
            {savedState === "saving" ? "Saving..." : "Saved"}
          </span>
          <Button className="actsix-btn-primary h-9 px-3 text-xs" onClick={onAddWidget}>
            <Plus className="h-3.5 w-3.5" />
            Add Widget
          </Button>
          <Button variant="outline" className="actsix-btn-outline h-9 px-3 text-xs" onClick={onResetLayout}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Layout
          </Button>
          <Button variant="outline" className="actsix-btn-outline h-9 px-3 text-xs" onClick={onDone}>
            <Check className="h-3.5 w-3.5" />
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
