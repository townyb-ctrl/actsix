import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectTaskPane, { type TaskFilter } from "./ProjectTaskPane";

vi.mock("@/hooks/useCurrentPerson", () => ({
  useCurrentPerson: () => ({ person: { id: "me" }, loading: false }),
}));

const counts: Record<TaskFilter, number> = {
  open: 2,
  mine: 1,
  due: 0,
  done: 3,
  all: 5,
};

const renderPane = (overrides: Partial<React.ComponentProps<typeof ProjectTaskPane>> = {}) =>
  render(
    <ProjectTaskPane
      heading="Worship"
      filter="open"
      onFilterChange={() => {}}
      counts={counts}
      search=""
      onSearchChange={() => {}}
      tasks={[
        { id: "1", title: "Book sound equipment", minutes: 15 },
        { id: "2", title: "Finalize song list", minutes: 15 },
      ]}
      emptyMessage="No tasks here yet."
      addTargetName="Worship"
      addPeople={[]}
      onAddTask={async () => {}}
      onToggleTask={() => {}}
      onEditTask={() => {}}
      onDeleteTask={() => {}}
      {...overrides}
    />
  );

describe("ProjectTaskPane", () => {
  it("shows the section heading", () => {
    renderPane();

    expect(screen.getByRole("heading", { name: "Worship" })).toBeInTheDocument();
    expect(screen.queryByText(/open/)).not.toBeInTheDocument();
  });

  it("shows the leader's name", () => {
    renderPane({ leader: { id: "1", display_name: "Sarah Lee" } });

    expect(screen.getByText("Leader:")).toBeInTheDocument();
    expect(screen.getByText("Sarah Lee")).toBeInTheDocument();
  });

  it("shows the section description next to the leader", () => {
    renderPane({
      leader: { id: "1", display_name: "Sarah Lee" },
      description: "Sound, mics, and stage setup",
    });

    expect(screen.getByText("Sarah Lee")).toBeInTheDocument();
    expect(screen.getByText("Sound, mics, and stage setup")).toBeInTheDocument();
  });

  it("shows the description even without a leader", () => {
    renderPane({ description: "Sound, mics, and stage setup" });

    expect(screen.getByText("Sound, mics, and stage setup")).toBeInTheDocument();
    expect(screen.queryByText("Leader:")).not.toBeInTheDocument();
  });

  it("lists the tasks it is handed", () => {
    renderPane();

    expect(screen.getByText("Book sound equipment")).toBeInTheDocument();
    expect(screen.getByText("Finalize song list")).toBeInTheDocument();
  });

  it("reports the filter the user picked", () => {
    const onFilterChange = vi.fn();
    renderPane({ onFilterChange });

    fireEvent.click(screen.getByRole("button", { name: /Due soon/ }));

    expect(onFilterChange).toHaveBeenCalledWith("due");
  });

  it("explains an empty list instead of showing a blank pane", () => {
    renderPane({ tasks: [], emptyMessage: "Nothing here is assigned to you." });

    expect(screen.getByText("Nothing here is assigned to you.")).toBeInTheDocument();
  });

  // The compose fields used to sit open under every section at once. They now
  // stay behind one row until someone actually wants to add something.
  it("keeps the compose fields hidden until Add task is clicked", () => {
    renderPane();

    expect(screen.queryByPlaceholderText(/Add task to Worship/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));

    expect(screen.getByPlaceholderText(/Add task to Worship/)).toBeInTheDocument();
  });

  it("adds the typed task to the section in view", async () => {
    const onAddTask = vi.fn().mockResolvedValue(undefined);
    renderPane({ onAddTask });

    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));
    fireEvent.change(screen.getByPlaceholderText(/Add task to Worship/), {
      target: { value: "Confirm band call time" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });

    expect(onAddTask).toHaveBeenCalledWith({
      title: "Confirm band call time",
      due: "",
      assigned_person_id: "",
    });
  });

  it("does not submit an empty task", async () => {
    const onAddTask = vi.fn().mockResolvedValue(undefined);
    renderPane({ onAddTask });

    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });

    expect(onAddTask).not.toHaveBeenCalled();
  });

  it("only offers section controls when a real section is in view", () => {
    renderPane({ heading: "All tasks" });

    expect(screen.queryByRole("button", { name: /Edit section/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete section/ })).not.toBeInTheDocument();
  });
});
