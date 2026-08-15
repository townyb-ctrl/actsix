import { useId, useState } from "react";
import { Inbox, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickCaptureDialog({
  open,
  onOpenChange,
}: QuickCaptureDialogProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentFieldId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("inbox_items").insert({
        id: crypto.randomUUID(),
        title: content.trim(),
        user_id: user.id,
      });

      if (error) throw error;

      toast.success("Added to inbox");
      setContent("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating inbox item:", error);
      toast.error("Failed to add to inbox");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Capture"
      description="Capture a quick thought or task."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor={contentFieldId} className="sr-only">
          What's on your mind?
        </label>
        <Textarea
          id={contentFieldId}
          placeholder="What's on your mind?..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (content.trim() && !isSubmitting) {
                handleSubmit(e);
              }
            }
          }}
          className="min-h-[120px] resize-none text-base"
          autoFocus
        />
        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center">
              <Inbox className="w-4 h-4 mr-1.5" />
              Saves to Inbox
            </span>
            <span className="hidden sm:inline-block text-xs bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">
              ⌘Enter
            </span>
          </div>
          <Button type="submit" disabled={!content.trim() || isSubmitting} className="min-w-[100px]">
            {isSubmitting ? (
              "Saving..."
            ) : (
              <>
                Save <Send className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}