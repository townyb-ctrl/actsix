import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConfirm } from "./useConfirm";

describe("useConfirm", () => {
  it("splits 'Question? Detail.' into title/description and resolves true on confirm", async () => {
    const { result } = renderHook(() => useConfirm());

    let confirmed: Promise<boolean> | null = null;
    act(() => {
      confirmed = result.current.confirmAction('Delete "Foo"? This can\'t be undone.');
    });

    expect(result.current.confirmDialog.props.title).toBe('Delete "Foo"?');
    expect(result.current.confirmDialog.props.description).toBe("This can't be undone.");
    expect(result.current.confirmDialog.props.open).toBe(true);

    act(() => {
      result.current.confirmDialog.props.onConfirm();
    });

    await expect(confirmed).resolves.toBe(true);
  });

  it("resolves false when dismissed without confirming", async () => {
    const { result } = renderHook(() => useConfirm());

    let confirmed: Promise<boolean> | null = null;
    act(() => {
      confirmed = result.current.confirmAction("Remove this?");
    });

    act(() => {
      result.current.confirmDialog.props.onOpenChange(false);
    });

    await expect(confirmed).resolves.toBe(false);
  });

  it("uses the whole message as the title when there's no '?'", () => {
    const { result } = renderHook(() => useConfirm());

    act(() => {
      void result.current.confirmAction("Archive this course");
    });

    expect(result.current.confirmDialog.props.title).toBe("Archive this course");
    expect(result.current.confirmDialog.props.description).toBe("");
  });
});
