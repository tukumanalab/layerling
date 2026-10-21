import { describe, expect, it } from "vitest";
import { PEN_TIP_HALF_WIDTH, penTipPosition } from "@/lib/penHoverTip";

const screen = { width: 1180, height: 820 };

describe("penTipPosition", () => {
  it("puts the text under the middle of the control", () => {
    const place = penTipPosition({ left: 500, right: 540, top: 100, bottom: 140 }, screen);
    expect(place.left).toBe(520);
    expect(place.top).toBe(148);
    expect(place.above).toBe(false);
  });

  it("keeps the text on the screen at the left and right edge", () => {
    expect(penTipPosition({ left: 0, right: 30, top: 100, bottom: 140 }, screen).left).toBe(PEN_TIP_HALF_WIDTH + 8);
    expect(penTipPosition({ left: 1150, right: 1180, top: 100, bottom: 140 }, screen).left).toBe(screen.width - PEN_TIP_HALF_WIDTH - 8);
  });

  it("goes above the control when there is no room below", () => {
    const place = penTipPosition({ left: 500, right: 540, top: 780, bottom: 815 }, screen);
    expect(place.above).toBe(true);
    expect(place.top).toBeLessThan(780);
  });

  it("stays usable on a screen narrower than the text", () => {
    const place = penTipPosition({ left: 10, right: 40, top: 100, bottom: 140 }, { width: 200, height: 500 });
    expect(place.left).toBeGreaterThan(0);
  });
});
