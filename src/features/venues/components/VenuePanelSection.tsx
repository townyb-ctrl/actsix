import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  title: string;
  /**
   * What the block says while it is shut. A disclosure that hides its answer
   * costs a click to read; one that states the answer on the lid costs nothing.
   */
  hint?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * A block inside a hire panel that stays shut until somebody wants it.
 *
 * The hire sections used to stack every setup form open at full height beside
 * the lists people actually read on the day, so a filled hire was a long scroll
 * past wording, presets and settings nobody had come for. Setup folds; the
 * lists and the numbers do not.
 *
 * `details` rather than a button and a div: open/close, the keyboard, and
 * find-in-page opening the right section are all free and already correct.
 */
export default function VenuePanelSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    // Controlled rather than left to the DOM: these panels re-render every time
    // the hire refetches, and an uncontrolled details snaps shut when they do.
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      {/* The mark sits on the right so every sub-heading in a panel, folding or
          not, starts its label on the same vertical line. */}
      <summary className="venue-disclosure">
        <span className="label-eyebrow">{title}</span>
        {hint && <span className="venue-disclosure-hint">{hint}</span>}
        <ChevronRight className="venue-disclosure-mark" aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}
