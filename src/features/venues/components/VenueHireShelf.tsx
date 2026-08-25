import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import type { HireConcern } from "@/features/venues/lib/venueHireBoard";

type Props = {
  concerns: HireConcern[];
  /**
   * Controlled by the page, not held here: the page has to know which row is
   * open so it can refuse to promote that concern into the stack above while
   * somebody is typing in it.
   */
  openId: HireConcern["id"] | null;
  onOpenChange: (id: HireConcern["id"] | null) => void;
  /** The real panel for a concern, rendered only once somebody opens its row. */
  render: (id: HireConcern["id"]) => ReactNode;
};

/**
 * Everything on this hire that nobody has to touch, one line each.
 *
 * The page used to file all fourteen panels behind six tabs, so seeing that the
 * quote was sent and the contract was signed took two clicks and two screens of
 * scrolling past forms nobody had come for. Settled work still has to be
 * *visible* - it is how somebody knows the hire is actually in hand - but it
 * does not need its whole panel open to say so. So the row states the answer,
 * and the panel is one click away, in place, without leaving the page.
 */
export default function VenueHireShelf({ concerns, openId, onOpenChange, render }: Props) {
  if (concerns.length === 0) return null;

  return (
    // No head of its own: the group heading above already names this set and
    // counts it, and two headings for one list is the chrome the tabs were.
    <section className="st-panel" aria-label="Nothing needed on this hire">
      {concerns.map((concern) => {
        const isOpen = openId === concern.id;

        return (
          <div key={concern.id}>
            <button
              type="button"
              className="st-shelf-row"
              aria-expanded={isOpen}
              onClick={() => onOpenChange(isOpen ? null : concern.id)}
            >
              <span className="st-shelf-name">{concern.name}</span>
              <span className="st-shelf-status">{concern.status}</span>
              <ChevronRight className="st-shelf-mark" aria-hidden="true" />
            </button>

            {/* Mounted only when opened: fourteen panels' worth of forms and
                effects on every hire page, for the thirteen nobody asked for,
                is a page that is slow before it is useful. */}
            {isOpen && <div className="st-shelf-body">{render(concern.id)}</div>}
          </div>
        );
      })}
    </section>
  );
}
