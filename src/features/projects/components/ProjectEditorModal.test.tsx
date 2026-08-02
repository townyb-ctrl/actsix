import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectEditorModal from "./ProjectEditorModal";

const baseProject = {
  id: "p1",
  name: "SWBC Transition",
  area: "General",
  status: "In Progress",
  due_date: null,
  notes: "",
  is_event: false,
  add_to_calendar: false,
  created_at: "2026-01-01T00:00:00Z",
};

describe("ProjectEditorModal", () => {
  it("renders nothing when project is null", () => {
    const { container } = render(
      <ProjectEditorModal project={null} onChange={() => {}} onClose={() => {}} onSave={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the project name and calls onChange when edited", () => {
    const onChange = vi.fn();
    render(
      <ProjectEditorModal project={baseProject} onChange={onChange} onClose={() => {}} onSave={() => {}} />,
    );

    const nameInput = screen.getByLabelText("Project name");
    expect(nameInput).toHaveValue("SWBC Transition");

    fireEvent.change(nameInput, { target: { value: "New Name" } });

    expect(onChange).toHaveBeenCalledWith({ ...baseProject, name: "New Name" });
  });

  it("uses a solid primary Save button", () => {
    render(
      <ProjectEditorModal project={baseProject} onChange={() => {}} onClose={() => {}} onSave={() => {}} />,
    );

    const saveButton = screen.getByRole("button", { name: /save project/i });
    expect(saveButton.className).toContain("actsix-btn-primary");
  });

  it("calls onSave when Save is clicked and onClose when Cancel is clicked", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <ProjectEditorModal project={baseProject} onChange={() => {}} onClose={onClose} onSave={onSave} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /save project/i }));
    expect(onSave).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders This project is an event as a real checkbox", () => {
    render(
      <ProjectEditorModal project={baseProject} onChange={() => {}} onClose={() => {}} onSave={() => {}} />,
    );

    expect(screen.getByRole("checkbox", { name: /this project is an event/i })).toBeInTheDocument();
  });

  it("shows the delete action only when onDelete is provided", () => {
    const { rerender } = render(
      <ProjectEditorModal project={baseProject} onChange={() => {}} onClose={() => {}} onSave={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /delete project/i })).not.toBeInTheDocument();

    rerender(
      <ProjectEditorModal
        project={baseProject}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /delete project/i })).toBeInTheDocument();
  });
});
