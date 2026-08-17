import { useRef } from "react";

export type VenueHireSectionId = "overview" | "dates" | "money" | "plan" | "day" | "after";

export type VenueHireRailSection = {
  id: VenueHireSectionId;
  name: string;
  /**
   * Things still wanting a person's attention in that section. Shown only when
   * non-zero: a badge reading "0" is noise, and a badge that is always there
   * stops meaning anything.
   */
  attention: number;
};

type Props = {
  sections: VenueHireRailSection[];
  activeId: VenueHireSectionId;
  onSelect: (id: VenueHireSectionId) => void;
};

/** The pane these tabs drive, so `aria-controls` and the pane agree. */
export const HIRE_PANE_ID = "hire-section-pane";
export const hireTabId = (id: VenueHireSectionId) => `hire-tab-${id}`;

/**
 * Section switcher for a hire, in the shape the project detail page already
 * uses: a scrollable strip of chips on phones, a vertical rail from lg up.
 *
 * The rail exists because a hire now carries a dozen panels. Stacking them all
 * made the page a scroll rather than a place, and answered none of "where am I,
 * where can I go, what is there".
 *
 * It is a tablist, not navigation: nothing here changes page, and calling it a
 * nav told screen-reader users to expect links to somewhere else. Tabs also buy
 * the arrow-key behaviour people already expect - one tab stop for the whole
 * rail, arrows to move within it.
 */
export default function VenueHireSectionRail({ sections, activeId, onSelect }: Props) {
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const moveTo = (index: number) => {
    const wrapped = (index + sections.length) % sections.length;
    const next = sections[wrapped];
    onSelect(next.id);
    // Roving focus follows selection, which is what makes arrow keys feel like
    // tabs rather than a list that happens to respond to keys.
    tabsRef.current[wrapped]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: sections.length - 1,
    };

    if (!(event.key in keys)) return;
    event.preventDefault();
    moveTo(keys[event.key]);
  };

  return (
    // min-w-0 is load-bearing: without it this grid child takes its min-content
    // from the six chips inside, which sets the whole page column to ~459px and
    // clips every card off the right of a phone.
    <div className="min-w-0 lg:sticky lg:top-4">
      <div
        role="tablist"
        aria-label="Hire sections"
        className="actsix-view-tabs flex w-full gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] lg:flex-col lg:overflow-visible"
      >
        {sections.map((section, index) => {
          const active = section.id === activeId;

          return (
            <button
              key={section.id}
              ref={(element) => {
                tabsRef.current[index] = element;
              }}
              type="button"
              role="tab"
              id={hireTabId(section.id)}
              aria-selected={active}
              aria-controls={HIRE_PANE_ID}
              tabIndex={active ? 0 : -1}
              data-state={active ? "active" : "inactive"}
              className="actsix-view-tab shrink-0 lg:w-full"
              onClick={() => onSelect(section.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="truncate text-[13px] font-bold">{section.name}</span>
              {section.attention > 0 && (
                <span className="actsix-view-tab-count">
                  {section.attention}
                  <span className="sr-only"> wanting attention</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
