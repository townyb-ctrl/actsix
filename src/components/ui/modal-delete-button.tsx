import { useState } from "react";
import { Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";

type Props = {
  /** What is being removed, in the user's words: "payment", "quote line". */
  what: string;
  /** Runs only after the confirm dialog is answered. */
  onConfirm: () => void;
  deleting: boolean;
};

/**
 * The "Remove" button that belongs on the left of a `FormDialog` footer.
 *
 * It exists to make the confirm step unskippable. Every editor modal had the
 * same ghost-red button wired straight to its delete call, so one mis-aimed
 * click destroyed a payment record or an incident report with no dialog and no
 * undo. Owning the button and the confirm together means a modal cannot get
 * one without the other.
 */
export function ModalDeleteButton({ what, onConfirm, deleting }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mr-auto text-destructive hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
      >
        <Trash2 className="h-4 w-4" />
        {deleting ? "Removing…" : "Remove"}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove this ${what}?`}
        description={`This permanently removes the ${what}. It cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />
    </>
  );
}
