import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckboxField, Field, FieldGroup, FieldRow, fieldControlClass } from "./field";

describe("Field", () => {
  it("renders a label wired to the control via htmlFor/id and an optional hint", () => {
    render(
      <Field label="Project name" htmlFor="project-name" hint="Renaming also updates linked tasks.">
        <input id="project-name" />
      </Field>,
    );

    const input = screen.getByLabelText("Project name");
    expect(input).toBeInTheDocument();
    expect(screen.getByText("Renaming also updates linked tasks.")).toBeInTheDocument();
  });

  it("omits the hint element when no hint is passed", () => {
    render(
      <Field label="Area" htmlFor="area">
        <input id="area" />
      </Field>,
    );

    expect(screen.queryByText(/./, { selector: "p" })).not.toBeInTheDocument();
  });
});

describe("FieldGroup", () => {
  it("renders a title and its children", () => {
    render(
      <FieldGroup title="Schedule">
        <div>child content</div>
      </FieldGroup>,
    );

    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});

describe("FieldRow", () => {
  it("renders its children in a row container", () => {
    render(
      <FieldRow>
        <div>left</div>
        <div>right</div>
      </FieldRow>,
    );

    expect(screen.getByText("left")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
  });
});

describe("CheckboxField", () => {
  it("renders a real checkbox and calls onCheckedChange with the new value", () => {
    const onCheckedChange = vi.fn();
    render(
      <CheckboxField
        id="is-event"
        label="This project is an event"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "This project is an event" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("fieldControlClass", () => {
  it("is a non-empty class string", () => {
    expect(typeof fieldControlClass).toBe("string");
    expect(fieldControlClass.length).toBeGreaterThan(0);
  });
});
