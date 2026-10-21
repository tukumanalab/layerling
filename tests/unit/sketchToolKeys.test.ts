import { describe, expect, it } from "vitest";
import { SKETCH_TOOL_KEYS } from "@/components/SketchWorkspace";

describe("sketch tool keys (#347)", () => {
  it("picks the drawing tools in the order of the bar", () => {
    expect(SKETCH_TOOL_KEYS).toEqual({ "1": "line", "2": "bezier", "3": "smooth", "4": "refine" });
  });
});
