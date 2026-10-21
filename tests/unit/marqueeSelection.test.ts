import { describe, expect, it } from "vitest";
import { boundsInsideRect, marqueeMode } from "@/lib/marqueeSelection";

describe("selection frame by direction (#430)", () => {
  it("touches everything in both directions as long as the switch is off", () => {
    expect(marqueeMode(false, 10, 200)).toBe("touch");
    expect(marqueeMode(false, 200, 10)).toBe("touch");
  });

  it("takes only what lies inside when dragged to the right, everything it touches when dragged to the left", () => {
    expect(marqueeMode(true, 10, 200)).toBe("enclose");
    expect(marqueeMode(true, 200, 10)).toBe("touch");
  });

  it("turns the frame around while Alt is held (#572)", () => {
    expect(marqueeMode(true, 10, 200, true)).toBe("touch");
    expect(marqueeMode(true, 200, 10, true)).toBe("enclose");
    // With the switch off, Alt gives the frame that takes only what lies completely inside, whichever way it is dragged.
    expect(marqueeMode(false, 10, 200, true)).toBe("enclose");
    expect(marqueeMode(false, 200, 10, true)).toBe("enclose");
    expect(marqueeMode(false, 200, 10, false)).toBe("touch");
  });

  it("counts a body as inside only when its whole frame is", () => {
    const rect = { left: 10, top: 10, right: 100, bottom: 100 };
    expect(boundsInsideRect({ minX: 20, maxX: 90, minY: 20, maxY: 90 }, rect)).toBe(true);
    expect(boundsInsideRect({ minX: 10, maxX: 100, minY: 10, maxY: 100 }, rect)).toBe(true);
    expect(boundsInsideRect({ minX: 5, maxX: 90, minY: 20, maxY: 90 }, rect)).toBe(false);
    expect(boundsInsideRect({ minX: 20, maxX: 120, minY: 20, maxY: 90 }, rect)).toBe(false);
    expect(boundsInsideRect({ minX: 20, maxX: 90, minY: 20, maxY: 101 }, rect)).toBe(false);
  });
});
