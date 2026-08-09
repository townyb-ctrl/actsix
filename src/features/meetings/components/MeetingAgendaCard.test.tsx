import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MeetingAgendaCard } from "./MeetingAgendaCard";
import { makeAgendaPoint, makeAgendaSection, type AgendaSection } from "@/features/meetings/lib/meetingAgenda";

const section = (overrides: Partial<AgendaSection> = {}): AgendaSection => ({
  ...makeAgendaSection(),
  id: "s1",
  heading: "Weekend Feedback",
  ...overrides,
});

const point = (id: string, text: string, date = "") => ({
  ...makeAgendaPoint(),
  id,
  text,
  date,
});

describe("MeetingAgendaCard", () => {
  it("lists section headings with their written-point count, points hidden until asked for", () => {
    const draft = [
      section({ points: [point("p1", "Sunday School"), point("p2", "Youth night"), point("p3", "")] }),
    ];

    render(<MeetingAgendaCard sections={draft} onEdit={() => {}} />);

    expect(screen.getByText("Weekend Feedback")).toBeInTheDocument();
    // Blank point rows never reach the reader - only the two with text count.
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("Sunday School")).not.toBeInTheDocument();
  });

  it("reveals a section's points, with the same numbering the minutes use", () => {
    const draft = [
      section({
        points: [
          { ...point("p1", "Sunday School"), children: [point("c1", "Sound desk")] },
          point("p2", "Youth night"),
        ],
      }),
    ];

    render(<MeetingAgendaCard sections={draft} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("Sunday School")).toBeInTheDocument();
    expect(screen.getByText("1.1")).toBeInTheDocument();
    expect(screen.getByText("1.2")).toBeInTheDocument();
    expect(screen.getByText("1.1.1")).toBeInTheDocument();
    expect(screen.getByText("Sound desk")).toBeInTheDocument();
  });

  it("shows a date beside a point only on a Dated-layout section", () => {
    const dated = [section({ layout: "dated", points: [point("p1", "Elders retreat", "2026-09-12")] })];
    const { unmount } = render(<MeetingAgendaCard sections={dated} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/Sep 12, 2026/)).toBeInTheDocument();
    unmount();

    const listed = [section({ layout: "list", points: [point("p1", "Elders retreat", "2026-09-12")] })];
    render(<MeetingAgendaCard sections={listed} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByText(/Sep 12, 2026/)).not.toBeInTheDocument();
  });

  it("hides sections that hold nothing, and offers the empty state when none are left", () => {
    render(<MeetingAgendaCard sections={[makeAgendaSection()]} onEdit={() => {}} />);

    expect(screen.getByText(/No agenda yet/i)).toBeInTheDocument();
  });

  it("routes Edit to the agenda builder", () => {
    const onEdit = vi.fn();
    render(<MeetingAgendaCard sections={[section()]} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
