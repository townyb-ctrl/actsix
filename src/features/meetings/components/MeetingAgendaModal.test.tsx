import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MeetingAgendaModal } from "./MeetingAgendaModal";
import { makeAgendaSection, type AgendaSection } from "@/features/meetings/lib/meetingAgenda";

const baseSection = (overrides: Partial<AgendaSection> = {}): AgendaSection => ({
  ...makeAgendaSection(),
  id: "s1",
  heading: "Week Ahead",
  ...overrides,
});

describe("MeetingAgendaModal", () => {
  it("switching a section's layout to Dated calls onChange with that layout applied", () => {
    const onChange = vi.fn();
    const draft = [baseSection({ points: [{ id: "p1", text: "Link Ladies", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Dated" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0](draft);
    expect(result[0].layout).toBe("dated");
  });

  it("a Dated-layout section shows a date input per point and no sub-point control", () => {
    const draft = [baseSection({ layout: "dated", points: [{ id: "p1", text: "Link Ladies", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    expect(screen.getByLabelText(/point 1 date/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add sub-point/i })).not.toBeInTheDocument();
  });

  it("adding a sub-point on a List-layout section nests a child under that point", () => {
    const onChange = vi.fn();
    const draft = [baseSection({ points: [{ id: "p1", text: "Office Admin", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Add sub-point/i }));

    const result = onChange.mock.calls[0][0](draft);
    expect(result[0].points[0].children).toHaveLength(1);
  });

  it("keeps tag/subtitle collapsed behind a toggle for a plain section", () => {
    const draft = [baseSection()];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    expect(screen.queryByLabelText(/section 1 tag/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tag \/ Subtitle/i })).toBeInTheDocument();
  });

  it("opens tag/subtitle automatically when a section already has one set", () => {
    const draft = [baseSection({ tag: "(Allan)" })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    expect(screen.getByLabelText(/section 1 tag/i)).toBeInTheDocument();
  });

  it("typing a tag, after opening the toggle, calls onChange with the tag applied to that section", () => {
    const onChange = vi.fn();
    const draft = [baseSection()];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Tag \/ Subtitle/i }));
    fireEvent.change(screen.getByLabelText(/section 1 tag/i), { target: { value: "(Allan)" } });

    const result = onChange.mock.calls[0][0](draft);
    expect(result[0].tag).toBe("(Allan)");
  });
});
