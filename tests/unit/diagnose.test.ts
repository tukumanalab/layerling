import { describe, expect, it } from "vitest";
import { describePointerEvent, describeEventTarget, diagnoseRequested } from "@/lib/diagnose";

describe("the diagnostic strip (#524)", () => {
  it("only starts when the address asks for it", () => {
    expect(diagnoseRequested("?editor=1&diagnose=1")).toBe(true);
    expect(diagnoseRequested("?diagnose")).toBe(true);
    expect(diagnoseRequested("?editor=1")).toBe(false);
    expect(diagnoseRequested("")).toBe(false);
  });

  it("names the element a pointer hit by tag, id and first class", () => {
    expect(describeEventTarget({ tagName: "DIV", id: "", className: "three-workplane-host extra" })).toBe("DIV.three-workplane-host");
    expect(describeEventTarget({ tagName: "BUTTON", id: "ok", className: "" })).toBe("BUTTON#ok");
    expect(describeEventTarget({ tagName: "svg", id: "", className: { baseVal: "x" } })).toBe("svg");
    expect(describeEventTarget(null)).toBe("-");
    expect(describeEventTarget({})).toBe("-");
  });

  it("writes one line per pointer event", () => {
    const line = describePointerEvent({ type: "pointerdown", pointerType: "touch", pointerId: 3, isPrimary: true, target: { tagName: "DIV", id: "", className: "a" } });
    expect(line).toBe("down touch #3 P DIV.a");
    expect(describePointerEvent({ type: "pointercancel", pointerType: "pen", pointerId: 1, isPrimary: false })).toBe("cancel pen #1 - -");
  });
});
