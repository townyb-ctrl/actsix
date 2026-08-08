import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MeetingPrintSheet } from "./MeetingPrintSheet";

const base = {
  workspaceName: "Grace Community Church",
  title: "Elders Meeting",
  date: "2026-09-12",
  time: "19:00",
  location: "Church Hall",
  attendees: ["Allan", "Bev"],
  apologies: ["Chris"],
  notes: "1. WEEKEND FEEDBACK\n1.1 Sunday service\nNotes:\nDecisions:",
};

describe("MeetingPrintSheet", () => {
  it("puts the letterhead, meeting details, and both name lists on the sheet", () => {
    render(<MeetingPrintSheet {...base} logoUrl="https://example.test/logo.png" />);

    expect(screen.getByText("Grace Community Church")).toBeInTheDocument();
    expect(screen.getByText("Elders Meeting")).toBeInTheDocument();
    // Locale-formatted, so assert on the parts rather than one fixed ordering.
    expect(screen.getByText(/Saturday/)).toBeInTheDocument();
    expect(screen.getByText(/September/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Church Hall/)).toBeInTheDocument();
    expect(screen.getByText(/Allan, Bev/)).toBeInTheDocument();
    expect(screen.getByText(/Chris/)).toBeInTheDocument();
  });

  it("renders the logo decoratively - the workspace name beside it already says who this is", () => {
    render(<MeetingPrintSheet {...base} logoUrl="https://example.test/logo.png" />);

    // alt="" keeps a screen reader from announcing the org name twice.
    const logo = document.querySelector<HTMLImageElement>("img.actsix-print-logo");
    expect(logo).not.toBeNull();
    expect(logo?.getAttribute("alt")).toBe("");
  });

  it("drops the logo entirely when the workspace hasn't uploaded one", () => {
    render(<MeetingPrintSheet {...base} logoUrl={null} />);

    expect(document.querySelector("img.actsix-print-logo")).toBeNull();
    expect(screen.getByText("Grace Community Church")).toBeInTheDocument();
  });

  it("says so plainly when a meeting has no minutes, rather than printing a blank page", () => {
    render(<MeetingPrintSheet {...base} notes="" />);

    expect(screen.getByText(/No minutes were written/i)).toBeInTheDocument();
  });

  it("omits the people block when there are no attendees or apologies", () => {
    render(<MeetingPrintSheet {...base} attendees={[]} apologies={[]} />);

    expect(screen.queryByText("Present")).not.toBeInTheDocument();
    expect(screen.queryByText("Apologies")).not.toBeInTheDocument();
  });
});
