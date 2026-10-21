import { describe, expect, it } from "vitest";
import { MIN_ALIGN_HANDLE_GAP, spreadAlignHandles } from "@/lib/alignHandleSpread";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("alignment handles keep apart on the screen (#486)", () => {
  it("leaves handles that are far enough apart where they are", () => {
    const [min, center, max] = spreadAlignHandles({ x: 100, y: 200 }, { x: 200, y: 200 }, { x: 300, y: 200 }, { x: 1, y: 0 });
    expect(min).toEqual({ x: 100, y: 200 });
    expect(center).toEqual({ x: 200, y: 200 });
    expect(max).toEqual({ x: 300, y: 200 });
  });

  it("pushes close handles apart along their line, the middle one stays", () => {
    const [min, center, max] = spreadAlignHandles({ x: 198, y: 100 }, { x: 200, y: 100 }, { x: 202, y: 100 }, { x: 1, y: 0 });
    expect(center).toEqual({ x: 200, y: 100 });
    expect(min.x).toBeLessThan(200);
    expect(max.x).toBeGreaterThan(200);
    expect(distance(min, center)).toBeGreaterThanOrEqual(MIN_ALIGN_HANDLE_GAP - 1e-9);
    expect(distance(max, center)).toBeGreaterThanOrEqual(MIN_ALIGN_HANDLE_GAP - 1e-9);
    expect(min.y).toBeCloseTo(100);
    expect(max.y).toBeCloseTo(100);
  });

  it("keeps the order minimum, middle, maximum along a slanted line", () => {
    const [min, center, max] = spreadAlignHandles({ x: 100, y: 100 }, { x: 103, y: 102 }, { x: 106, y: 104 }, { x: 1, y: 1 });
    expect(min.x).toBeLessThan(center.x);
    expect(max.x).toBeGreaterThan(center.x);
    expect(min.y).toBeLessThan(center.y);
    expect(max.y).toBeGreaterThan(center.y);
  });

  it("uses the axis direction when all three lie on one spot, and never returns NaN", () => {
    const [min, center, max] = spreadAlignHandles({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 50 }, { x: 0, y: 1 });
    expect(min).toEqual({ x: 50, y: 50 - MIN_ALIGN_HANDLE_GAP });
    expect(center).toEqual({ x: 50, y: 50 });
    expect(max).toEqual({ x: 50, y: 50 + MIN_ALIGN_HANDLE_GAP });
    const [a, , b] = spreadAlignHandles({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 0, y: 0 });
    expect([a.x, a.y, b.x, b.y].every(Number.isFinite)).toBe(true);
  });

  it("pushes only the handle that is too close", () => {
    const [min, , max] = spreadAlignHandles({ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 205, y: 0 }, { x: 1, y: 0 });
    expect(min).toEqual({ x: 100, y: 0 });
    expect(max.x).toBeCloseTo(200 + MIN_ALIGN_HANDLE_GAP);
  });
});
