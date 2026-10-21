import { describe, expect, it } from "vitest";
import { escapeWasHandled, markEscapeHandled } from "@/lib/escapeHandled";

describe("an Escape the work area used to cancel a drag (#440)", () => {
  it("is known to the editor's own Escape handling, and only that key press", () => {
    const first = new Event("keydown");
    const second = new Event("keydown");
    expect(escapeWasHandled(first)).toBe(false);
    markEscapeHandled(first);
    expect(escapeWasHandled(first)).toBe(true);
    expect(escapeWasHandled(second)).toBe(false);
  });
});
