import { fireEvent, render, screen, within } from "@testing-library/react";
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

/** The layout picker is a menu now, not three always-visible pills - open it
 *  before reaching for an option. */
const openLayoutMenu = (sectionNumber = 1) =>
  // Radix opens its menu on pointerdown/keydown, not on a synthetic click.
  fireEvent.keyDown(screen.getByRole("button", { name: new RegExp(`section ${sectionNumber} layout`, "i") }), {
    key: "Enter",
  });

describe("MeetingAgendaModal", () => {
  it("switching a section's layout to Dated calls onChange with that layout applied", () => {
    const onChange = vi.fn();
    const draft = [baseSection({ points: [{ id: "p1", text: "Link Ladies", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    openLayoutMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Dated/ }));

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

  it("rests every written section as a summary card and opens one on click", () => {
    const draft = [
      baseSection({ id: "s1", heading: "Weekend Feedback", points: [{ id: "p1", text: "Sunday School", date: "", children: [] }] }),
      baseSection({ id: "s2", heading: "Office Admin", points: [{ id: "p2", text: "Rosters", date: "", children: [] }] }),
    ];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    // Nothing is empty, so nothing opens on its own - both rest as summaries.
    expect(screen.queryByLabelText(/section 1 heading/i)).not.toBeInTheDocument();
    expect(screen.getByText("Weekend Feedback")).toBeInTheDocument();
    expect(screen.getByText("Sunday School")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit section 1/i }));
    expect(screen.getByLabelText(/section 1 heading/i)).toBeInTheDocument();
    // Opening one closes the other - only one card is written in at a time.
    expect(screen.queryByLabelText(/section 2 heading/i)).not.toBeInTheDocument();
  });

  it("opens the first empty section so a fresh one is ready to type into", () => {
    const draft = [
      baseSection({ id: "s1", heading: "Weekend Feedback", points: [{ id: "p1", text: "Sunday School", date: "", children: [] }] }),
      baseSection({ id: "s2", heading: "", points: [{ id: "p2", text: "", date: "", children: [] }] }),
    ];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    expect(screen.getByLabelText(/section 2 heading/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/section 1 heading/i)).not.toBeInTheDocument();
  });

  it("pressing Enter in a point adds the next point right below it", () => {
    const onChange = vi.fn();
    const draft = [
      baseSection({
        points: [
          { id: "p1", text: "First", date: "", children: [] },
          { id: "p2", text: "Second", date: "", children: [] },
        ],
      }),
    ];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.keyDown(screen.getByLabelText("Section 1, point 1"), { key: "Enter" });

    const result = onChange.mock.calls[0][0](draft);
    expect(result[0].points.map((p: { text: string }) => p.text)).toEqual(["First", "", "Second"]);
  });

  it("pressing Tab in a point makes it a sub-point of the point above", () => {
    const onChange = vi.fn();
    const draft = [
      baseSection({
        points: [
          { id: "p1", text: "Office Admin", date: "", children: [] },
          { id: "p2", text: "Rosters", date: "", children: [] },
        ],
      }),
    ];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.keyDown(screen.getByLabelText("Section 1, point 2"), { key: "Tab" });

    const result = onChange.mock.calls[0][0](draft);
    expect(result[0].points).toHaveLength(1);
    expect(result[0].points[0].children.map((c: { text: string }) => c.text)).toEqual(["Rosters"]);
  });

  it("leaves Tab alone on the first point - there's nothing above to nest under", () => {
    const onChange = vi.fn();
    const draft = [baseSection({ points: [{ id: "p1", text: "Office Admin", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.keyDown(screen.getByLabelText("Section 1, point 1"), { key: "Tab" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("duplicating a section copies it below with fresh ids", () => {
    const onChange = vi.fn();
    const draft = [baseSection({ points: [{ id: "p1", text: "Sunday School", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /duplicate section 1/i }));

    const result = onChange.mock.calls[0][0](draft);
    expect(result).toHaveLength(2);
    expect(result[1].heading).toBe("Week Ahead");
    expect(result[1].id).not.toBe(result[0].id);
    expect(result[1].points[0].id).not.toBe(result[0].points[0].id);
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
    const undo = (vi.mocked(toast).mock.calls[0][1] as unknown as { action: { onClick: () => void } }).action.onClick;
    undo();
    const afterUndo = onChange.mock.calls[1][0](afterDelete);
    expect(afterUndo[0].points.map((p: { text: string }) => p.text)).toEqual(["Keep this one", "Delete me"]);
  });

  it("explains inside the layout menu what each option does to the minutes", () => {
    const draft = [baseSection()];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    openLayoutMenu();

    expect(within(screen.getByRole("menuitem", { name: /^List/ })).getByText(/numbered points/i)).toBeInTheDocument();
    expect(within(screen.getByRole("menuitem", { name: /^Boxed/ })).getByText(/plain bullet list/i)).toBeInTheDocument();
  });

  it("gives each section a real heading so a screen reader can jump section-to-section", () => {
    const draft = [
      baseSection({ id: "s1", heading: "Weekend Feedback" }),
      baseSection({ id: "s2", heading: "" }),
    ];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    expect(screen.getByRole("heading", { level: 3, name: /section 1: weekend feedback/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /section 2: untitled section/i })).toBeInTheDocument();
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
