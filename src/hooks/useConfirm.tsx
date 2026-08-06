import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type PendingConfirm = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
};

/**
 * Promise-based drop-in for `window.confirm()`: `await confirmAction(message)`
 * resolves to true/false, same call shape, but renders the app's own themed
 * `ConfirmDialog` (focus trap, Escape-to-close) instead of the unbranded
 * native dialog. `message` splits at the first "?" into title/description so
 * existing "Delete X? detail." strings render as a proper heading + body.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirmAction = useCallback(
    (message: string, options?: { confirmLabel?: string; destructive?: boolean }) => {
      const splitAt = message.indexOf("?");
      const title = splitAt === -1 ? message : message.slice(0, splitAt + 1);
      const description = splitAt === -1 ? "" : message.slice(splitAt + 1).trim();

      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setPending({ title, description, ...options });
      });
    },
    []
  );

  const settle = (confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setPending(null);
  };

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      title={pending?.title || ""}
      description={pending?.description || ""}
      confirmLabel={pending?.confirmLabel}
      destructive={pending?.destructive}
      onConfirm={() => settle(true)}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    />
  );

  return { confirmAction, confirmDialog };
}
