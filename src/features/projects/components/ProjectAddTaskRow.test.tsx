import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectAddTaskRow from "./ProjectAddTaskRow";

describe("ProjectAddTaskRow", () => {
  it("keeps the compose row collapsed until Add task is clicked", () => {
    render(<ProjectAddTaskRow targetName="Worship" people={[]} onAdd={async () => {}} />);

    expect(screen.queryByPlaceholderText(/Add task to Worship/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));
    expect(screen.getByPlaceholderText(/Add task to Worship/)).toBeInTheDocument();
  });

  it("dismisses via an icon-only close control rather than a text Cancel button", () => {
    render(<ProjectAddTaskRow targetName="Worship" people={[]} onAdd={async () => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));

    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: /close|dismiss/i });
    fireEvent.click(closeButton);

    expect(screen.queryByPlaceholderText(/Add task to Worship/)).not.toBeInTheDocument();
  });

  it("submits the trimmed title via onAdd", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ProjectAddTaskRow targetName="Worship" people={[]} onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));
    fireEvent.change(screen.getByPlaceholderText(/Add task to Worship/), {
      target: { value: "  Book sound equipment  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Book sound equipment" }),
    );
  });
});
