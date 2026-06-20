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
    <div className="sticky top-3 z-20 rounded-xl border border-border/65 bg-background/88 px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-extrabold text-muted-foreground">
          Layout editing
          <span className="ml-2 rounded-full border border-border/70 bg-card/75 px-2 py-0.5 text-[11px] text-brand-teal">
            {savedState === "saving" ? "Saving..." : "Saved"}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
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
            Finish
          </Button>
        </div>
      </div>
    </div>
  );
}
