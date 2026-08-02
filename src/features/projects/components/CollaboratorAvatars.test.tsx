import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CollaboratorAvatars, { type TeamMember } from "./CollaboratorAvatars";

const person = (id: string, display_name: string): TeamMember => ({ id, display_name });

describe("CollaboratorAvatars", () => {
  it("renders nothing when there are no collaborators", () => {
    const { container } = render(<CollaboratorAvatars collaborators={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the only collaborator is the excluded owner", () => {
    const { container } = render(
      <CollaboratorAvatars collaborators={[person("1", "Brandon Townsend")]} excludeId="1" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // The owner is named in text next to this stack and is usually also a
  // project_collaborators row, so without excludeId they appear twice.
  it("omits the owner from the stack", () => {
    render(
      <CollaboratorAvatars
        collaborators={[person("1", "Brandon Townsend"), person("2", "Wesley Reed")]}
        excludeId="1"
      />
    );

    expect(screen.getByText("Collaborators: Wesley Reed")).toBeInTheDocument();
  });

  it("lists every collaborator when no owner is excluded", () => {
    render(
      <CollaboratorAvatars
        collaborators={[person("1", "Brandon Townsend"), person("2", "Wesley Reed")]}
      />
    );

    expect(
      screen.getByText("Collaborators: Brandon Townsend, Wesley Reed")
    ).toBeInTheDocument();
  });

  it("drops duplicate rows for the same person", () => {
    render(
      <CollaboratorAvatars
        collaborators={[person("2", "Wesley Reed"), person("2", "Wesley Reed")]}
      />
    );

    expect(screen.getByText("Collaborators: Wesley Reed")).toBeInTheDocument();
  });

  it("collapses the tail into a +N once past the limit", () => {
    render(
      <CollaboratorAvatars
        collaborators={[
          person("1", "A One"),
          person("2", "B Two"),
          person("3", "C Three"),
          person("4", "D Four"),
          person("5", "E Five"),
          person("6", "F Six"),
        ]}
      />
    );

    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("shows no +N at exactly the limit", () => {
    render(
      <CollaboratorAvatars
        collaborators={[
          person("1", "A One"),
          person("2", "B Two"),
          person("3", "C Three"),
          person("4", "D Four"),
        ]}
      />
    );

    expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
  });

  it("counts the excluded owner out of the overflow total", () => {
    render(
      <CollaboratorAvatars
        collaborators={[
          person("1", "Owner Person"),
          person("2", "B Two"),
          person("3", "C Three"),
          person("4", "D Four"),
          person("5", "E Five"),
        ]}
        excludeId="1"
      />
    );

    expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
  });
});
