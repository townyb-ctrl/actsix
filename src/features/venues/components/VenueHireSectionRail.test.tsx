import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VenueHireSectionRail, { type VenueHireRailSection } from "./VenueHireSectionRail";

const sections: VenueHireRailSection[] = [
  { id: "overview", name: "Overview", attention: 0 },
  { id: "dates", name: "Dates", attention: 0 },
  { id: "money", name: "Money", attention: 2 },
  { id: "plan", name: "Plan", attention: 0 },
  { id: "day", name: "On the day", attention: 0 },
  { id: "after", name: "Afterwards", attention: 0 },
];

describe("VenueHireSectionRail", () => {
  it("is a tablist, with only the active tab in the tab order", () => {
    render(<VenueHireSectionRail sections={sections} activeId="money" onSelect={vi.fn()} />);

    expect(screen.getByRole("tablist", { name: "Hire sections" })).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
    // One tab stop for the whole rail: arrows move within it.
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Money");
  });

  it("moves with the arrow keys, and wraps at both ends", () => {
    const onSelect = vi.fn();
    render(<VenueHireSectionRail sections={sections} activeId="dates" onSelect={onSelect} />);

    const active = screen.getByRole("tab", { selected: true });

    fireEvent.keyDown(active, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith("money");

    fireEvent.keyDown(active, { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenLastCalledWith("overview");

    fireEvent.keyDown(active, { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith("after");

    fireEvent.keyDown(active, { key: "Home" });
    expect(onSelect).toHaveBeenLastCalledWith("overview");
  });

  it("wraps past the first tab to the last", () => {
    const onSelect = vi.fn();
    render(<VenueHireSectionRail sections={sections} activeId="overview" onSelect={onSelect} />);

    fireEvent.keyDown(screen.getByRole("tab", { selected: true }), { key: "ArrowLeft" });

    expect(onSelect).toHaveBeenCalledWith("after");
  });

  it("says what a badge counts, rather than leaving a bare number", () => {
    render(<VenueHireSectionRail sections={sections} activeId="overview" onSelect={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /Money 2 wanting attention/i })).toBeInTheDocument();
  });
});
