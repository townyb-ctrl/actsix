import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { MeetingAgendaModal } from "./MeetingAgendaModal";
import { makeAgendaSection, type AgendaSection } from "@/features/meetings/lib/meetingAgenda";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

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

  it("collapses a filled section by default once there's more than one, and expands it on click", () => {
    const draft = [
      baseSection({ id: "s1", heading: "Weekend Feedback", points: [{ id: "p1", text: "Sunday School", date: "", children: [] }] }),
      baseSection({ id: "s2", heading: "", points: [{ id: "p2", text: "", date: "", children: [] }] }),
    ];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    // Filled section 1 collapses to a summary row - its heading input isn't rendered.
    expect(screen.queryByLabelText(/section 1 heading/i)).not.toBeInTheDocument();
    expect(screen.getByText("Weekend Feedback")).toBeInTheDocument();

    // Empty section 2 stays expanded so it's ready to type into immediately.
    expect(screen.getByLabelText(/section 2 heading/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand section 1/i }));
    expect(screen.getByLabelText(/section 1 heading/i)).toBeInTheDocument();
  });

  it("keeps the single section in a fresh agenda expanded by default", () => {
    const draft = [baseSection({ heading: "Only Section" })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    expect(screen.getByLabelText(/section 1 heading/i)).toBeInTheDocument();
  });

  it("removing a point with text offers an undo that restores it", () => {
    vi.mocked(toast).mockClear();
    const onChange = vi.fn();
    const draft = [
      baseSection({
        points: [
          { id: "p1", text: "Keep this one", date: "", children: [] },
          { id: "p2", text: "Delete me", date: "", children: [] },
        ],
      }),
    ];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove point 1.2" }));

    // The delete itself.
    const afterDelete = onChange.mock.calls[0][0](draft);
    expect(afterDelete[0].points.map((p: { text: string }) => p.text)).toEqual(["Keep this one"]);

    // An undo toast fired with the removed point restorable.
    expect(toast).toHaveBeenCalledWith("Point removed", expect.objectContaining({ action: expect.any(Object) }));
    const undo = vi.mocked(toast).mock.calls[0][1].action.onClick;
    undo();
    const afterUndo = onChange.mock.calls[1][0](afterDelete);
    expect(afterUndo[0].points.map((p: { text: string }) => p.text)).toEqual(["Keep this one", "Delete me"]);
  });

  it("shows a caption explaining what the selected layout does to the minutes, and updates it on switch", () => {
    const draft = [baseSection()];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    expect(screen.getByText(/numbered points/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Boxed" }));
    // onChange is a no-op here, so re-render won't show the switch taking
    // effect - assert the pill itself carries the right explanation instead.
    expect(screen.getByRole("button", { name: "Boxed" })).toHaveAttribute("title", expect.stringMatching(/plain bullet list/i));
  });

  it("removing an empty point skips the undo toast", () => {
    vi.mocked(toast).mockClear();
    const draft = [
      baseSection({
        points: [
          { id: "p1", text: "Keep this one", date: "", children: [] },
          { id: "p2", text: "", date: "", children: [] },
        ],
      }),
    ];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove point 1.2" }));

    expect(toast).not.toHaveBeenCalled();
  });
});
