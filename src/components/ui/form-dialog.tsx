import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FormDialogSize = "sm" | "md" | "lg";

const sizeClass: Record<FormDialogSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: string;
  description?: string;
  size?: FormDialogSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Shared dialog shell for ACTSIX forms. The footer's primary action must
 * always use `actsix-btn-primary` (solid teal) — that consistency is the
 * whole point of centralizing this shell.
 *
 * The repo also has `ResponsiveModal` (`@/components/ui/responsive-modal`),
 * which swaps between a `Dialog` and a `Drawer` at the 768px breakpoint and
 * remains the right choice for simpler title/description dialogs. `FormDialog`
 * is a different mechanism — a CSS bottom-sheet at 640px — for dialogs that
 * want the eyebrow/size/footer structure this component provides.
 */
export function FormDialog({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  size = "md",
  footer,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92svh] w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-h-[88vh]",
          "bottom-0 top-auto translate-y-0 rounded-t-[var(--radius-overlay)] rounded-b-none data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%] sm:rounded-[var(--radius-overlay)] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
          sizeClass[size],
        )}
      >
        <DialogHeader className="border-b border-border/70 p-4 pr-12 text-left sm:p-5">
          {eyebrow && <p className="label-eyebrow">{eyebrow}</p>}
          <DialogTitle className="mt-1">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
