import { useState } from "react";
import { Inbox, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type QuickCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const buildCaptureItems = (value: string, userId: string) => {
  const cleaned = value.trim();
  const parts = cleaned
    .split(/[,\r\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const captures = parts.length > 0 ? parts : [cleaned];

  return captures.map((capture) => ({
    id: crypto.randomUUID(),
    title: capture.slice(0, 140),
    user_id: userId,
    notes: captures.length === 1 ? cleaned : "",
  }));
};

export function QuickCaptureDialog({ open, onOpenChange }: QuickCaptureDialogProps) {
  const { user } = useAuth();
  const [capture, setCapture] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = capture.trim().length > 0 && !saving;

  const saveCapture = async () => {
    if (!user || !canSave) return;

    const captureItems = buildCaptureItems(capture, user.id);
    setSaving(true);

    const { error } = await supabase.from("inbox_items").insert(captureItems);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCapture("");
    onOpenChange(false);
    toast.success(
      captureItems.length === 1
        ? "Captured to inbox"
        : `${captureItems.length} items captured to inbox`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-md bg-brand-teal/10 text-brand-teal">
            <Inbox className="h-5 w-5" />
          </div>
          <DialogTitle>Quick Capture</DialogTitle>
          <DialogDescription>
            Drop thoughts here and keep working. Separate multiple inbox items with commas or new lines.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={capture}
          onChange={(event) => setCapture(event.target.value)}
          placeholder="Call Sarah, prep Sunday notes, review HBC flyer..."
          className="min-h-36 resize-none rounded-md"
          autoFocus
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-lg bg-brand-teal px-4 font-bold hover:bg-brand-teal/90"
            onClick={saveCapture}
            disabled={!canSave}
          >
            <Send className="h-4 w-4" />
            {saving ? "Capturing" : "Capture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
