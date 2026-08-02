import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectSectionEditorModal from "./ProjectSectionEditorModal";

const people = [{ id: "person-1", display_name: "Jamie Rivera" }];

describe("ProjectSectionEditorModal", () => {
  it("renders nothing when section is null", () => {
    const { container } = render(
      <ProjectSectionEditorModal
        section={null}
        saving={false}
        assignablePeople={people}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Add Section title and a Plus-icon primary button for a new section", () => {
    render(
      <ProjectSectionEditorModal
        section={{}}
        saving={false}
        assignablePeople={people}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Add Section" })).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: /add section/i });
    expect(saveButton.className).toContain("actsix-btn-primary");
  });

  it("shows Edit Section title and Save Section label for an existing section", () => {
    render(
      <ProjectSectionEditorModal
        section={{ id: "s1", name: "Worship" }}
        saving={false}
        assignablePeople={people}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Edit Section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save section/i })).toBeInTheDocument();
  });

  it("lists assignable people as leader options and calls onChange on selection", () => {
    const onChange = vi.fn();
    render(
      <ProjectSectionEditorModal
        section={{ id: "s1", name: "Worship" }}
        saving={false}
        assignablePeople={people}
        onChange={onChange}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    const leaderSelect = screen.getByLabelText("Leader");
    fireEvent.change(leaderSelect, { target: { value: "person-1" } });

    expect(onChange).toHaveBeenCalledWith({ id: "s1", name: "Worship", leader_person_id: "person-1" });
  });

  it("has exactly one dismiss control besides Cancel (no redundant Close pill)", () => {
    render(
      <ProjectSectionEditorModal
        section={{ id: "s1", name: "Worship" }}
        saving={false}
        assignablePeople={people}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    // FormDialog's shared Dialog shell always renders one sr-only-labeled
    // corner "Close" (X) button — that's standard chrome, not a redundant
    // pill. The old inline JSX additionally rendered its own visible
    // "Close" pill button in the header on top of the footer's "Cancel"
    // pill; this asserts that extra pill is gone (exactly one "Close"-named
    // control remains: the dialog's built-in X).
    expect(screen.getAllByRole("button", { name: /^close$/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });
});
