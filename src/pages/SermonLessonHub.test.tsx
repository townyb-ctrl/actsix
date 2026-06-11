import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SermonLessonHub from "./SermonLessonHub";

describe("SermonLessonHub", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:sermon-export"),
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("writes, formats, archives, searches, and exports a teaching item", () => {
    render(<SermonLessonHub />);

    fireEvent.change(screen.getByPlaceholderText("Title"), {
      target: { value: "Resurrection Hope" },
    });
    fireEvent.change(screen.getByPlaceholderText("Scripture"), {
      target: { value: "1 Corinthians 15" },
    });
    fireEvent.change(screen.getByPlaceholderText("Key takeaway"), {
      target: { value: "Hope reshapes faithful endurance." },
    });

    const editor = screen.getByTestId("sermon-hub-editor");
    editor.innerHTML = "<h1>Resurrection Hope</h1><p>The body matters to the gospel.</p>";
    fireEvent.input(editor);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(document.execCommand).toHaveBeenCalledWith("bold", false, undefined);

    fireEvent.click(screen.getByRole("button", { name: "Highlight Mint" }));
    expect(document.execCommand).toHaveBeenCalledWith("hiliteColor", false, "#DDF7DF");

    fireEvent.click(screen.getByTestId("sermon-hub-save"));
    fireEvent.click(screen.getByRole("button", { name: /Library/ }));

    const activeLibrary = screen.getByTestId("sermon-hub-active");
    expect(within(activeLibrary).getByText("Resurrection Hope")).toBeInTheDocument();
    expect(within(activeLibrary).getByText("1 Corinthians 15")).toBeInTheDocument();

    fireEvent.click(within(activeLibrary).getAllByRole("button", { name: "Archive" })[0]);

    const archiveLibrary = screen.getByTestId("sermon-hub-archive");
    expect(within(archiveLibrary).getByText("Resurrection Hope")).toBeInTheDocument();

    const archiveSearch = within(archiveLibrary).getByPlaceholderText("Search archive...");
    fireEvent.change(archiveSearch, { target: { value: "Corinthians" } });
    expect(within(archiveLibrary).getByText("Resurrection Hope")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sermon-hub-export-word"));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("stores references, YouTube links, images, and opens the PDF print export", () => {
    const print = vi.fn();
    const write = vi.fn();
    const close = vi.fn();
    const focus = vi.fn();

    vi.spyOn(window, "open").mockReturnValue({
      document: { write, close },
      focus,
      print,
    } as unknown as Window);

    vi.spyOn(window, "prompt").mockReturnValue("https://example.com/sermon-slide.jpg");

    render(<SermonLessonHub />);

    fireEvent.change(screen.getByPlaceholderText("Title"), {
      target: { value: "Prayer and Formation" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Resources/ }));

    const toolbar = screen.getByTestId("sermon-hub-toolbar");
    fireEvent.click(within(toolbar).getByRole("button", { name: "Image URL" }));
    expect(document.execCommand).toHaveBeenCalledWith(
      "insertImage",
      false,
      "https://example.com/sermon-slide.jpg"
    );

    const references = screen.getByTestId("sermon-hub-references");
    fireEvent.click(within(references).getByRole("button", { name: "Add reference" }));
    fireEvent.change(within(references).getByPlaceholderText("Title"), {
      target: { value: "Prayer commentary notes" },
    });
    fireEvent.change(within(references).getByPlaceholderText("URL"), {
      target: { value: "https://example.com/commentary" },
    });

    const media = screen.getByTestId("sermon-hub-media");
    fireEvent.click(within(media).getByRole("button", { name: "YouTube" }));
    const mediaTitles = within(media).getAllByPlaceholderText("Title");
    const mediaUrls = within(media).getAllByPlaceholderText("URL");

    fireEvent.change(mediaTitles[mediaTitles.length - 1], {
      target: { value: "Related sermon" },
    });
    fireEvent.change(mediaUrls[mediaUrls.length - 1], {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });

    fireEvent.click(screen.getByTestId("sermon-hub-save"));

    const savedItems = JSON.parse(localStorage.getItem("actsix-sermon-lesson-hub-items") || "[]");
    const savedItem = savedItems.find((item: { title: string }) => item.title === "Prayer and Formation");

    expect(savedItem.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Prayer commentary notes",
          url: "https://example.com/commentary",
        }),
      ])
    );
    expect(savedItem.media).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image",
          url: "https://example.com/sermon-slide.jpg",
        }),
        expect.objectContaining({
          type: "youtube",
          title: "Related sermon",
          url: "https://youtu.be/dQw4w9WgXcQ",
        }),
      ])
    );

    fireEvent.click(screen.getByTestId("sermon-hub-export-pdf"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Prayer and Formation"));
    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
  });
});
