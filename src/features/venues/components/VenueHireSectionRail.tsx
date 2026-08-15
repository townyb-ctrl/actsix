export type VenueHireSectionId = "dates" | "money" | "plan" | "day" | "after";

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

/**
 * Section switcher for a hire, in the shape the project detail page already
 * uses: a scrollable strip of chips on phones, a vertical rail from lg up.
 *
 * The rail exists because a hire now carries a dozen panels. Stacking them all
 * made the page a scroll rather than a place, and answered none of "where am I,
 * where can I go, what is there".
 */
export default function VenueHireSectionRail({ sections, activeId, onSelect }: Props) {
  return (
    <div className="lg:sticky lg:top-4">
      <nav
        aria-label="Hire sections"
        className="actsix-view-tabs flex gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] lg:flex-col lg:overflow-visible"
      >
        {sections.map((section) => {
          const active = section.id === activeId;

          return (
            <button
              key={section.id}
              type="button"
              data-state={active ? "active" : "inactive"}
              aria-current={active ? "true" : undefined}
              className="actsix-view-tab shrink-0 lg:w-full"
              onClick={() => onSelect(section.id)}
            >
              <span className="truncate text-[13px] font-bold">{section.name}</span>
              {section.attention > 0 && (
                <span className="actsix-view-tab-count">{section.attention}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
