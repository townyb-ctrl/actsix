import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormDialog } from "./form-dialog";

describe("FormDialog", () => {
  it("renders eyebrow, title, description, body, and footer when open", () => {
    render(
      <FormDialog
        open
        onOpenChange={() => {}}
        eyebrow="Edit Project"
        title="Project details"
        description="Update the project name, area, status, and notes."
        footer={<button>Save project</button>}
      >
        <div>body content</div>
      </FormDialog>,
    );

    expect(screen.getByText("Edit Project")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project details" })).toBeInTheDocument();
    expect(screen.getByText("Update the project name, area, status, and notes.")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save project" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <FormDialog open={false} onOpenChange={() => {}} title="Project details">
        <div>body content</div>
      </FormDialog>,
    );

    expect(screen.queryByText("body content")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when the built-in close control is activated", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialog open onOpenChange={onOpenChange} title="Project details">
        <div>body content</div>
      </FormDialog>,
    );

    screen.getByRole("button", { name: /close/i }).click();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("omits the eyebrow and description when not provided", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="Add Section">
        <div>body content</div>
      </FormDialog>,
    );

    expect(screen.getByRole("heading", { name: "Add Section" })).toBeInTheDocument();
  });
});
