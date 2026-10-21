import { describe, expect, it } from "vitest";
import { shapeMeshFootprint } from "@/components/SketchWorkspace";
import type { WorkplaneShape } from "@/types/layerling";

// #596: a body under a sketch is drawn with its real outline, not as the rectangle of its width and depth.
const shape = (overrides: Partial<WorkplaneShape>): WorkplaneShape => ({
  id: "s", name: "Shape", kind: "polygon", color: "#2563eb", x: 10, z: -5, elevation: 0, rotation: 0,
  width: 24, depth: 24, height: 10, size: 24, ...overrides,
});

function corners(d: string | null) {
  const numbers = (d ?? "").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
  const points: Array<[number, number]> = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) points.push([numbers[index], numbers[index + 1]]);
  return points;
}

describe("the outline of a body under a sketch (#596)", () => {
  it("follows a polygon: not the four corners of its box", () => {
    const footprint = shapeMeshFootprint(shape({ kind: "polygon", sides: 6 }));
    expect(footprint?.world).toBe(true);
    const points = corners(footprint?.outlineD ?? null);
    // A hexagon has six corners, and the box's four corners (x ± 12, z ± 12) are not among them.
    const unique = new Set(points.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`));
    expect(unique.size).toBe(6);
    const xs = points.map(([x]) => x);
    expect(Math.min(...xs)).toBeGreaterThan(10 - 12.01);
    expect(Math.max(...xs)).toBeLessThan(10 + 12.01);
  });

  it("stands where the body stands, turned as it is turned", () => {
    const plain = corners(shapeMeshFootprint(shape({ kind: "polygon", sides: 6 }))?.outlineD ?? null);
    const turned = corners(shapeMeshFootprint(shape({ kind: "polygon", sides: 6, rotation: 30 }))?.outlineD ?? null);
    const middle = (points: Array<[number, number]>) => [(Math.min(...points.map(([x]) => x)) + Math.max(...points.map(([x]) => x))) / 2, (Math.min(...points.map(([, z]) => z)) + Math.max(...points.map(([, z]) => z))) / 2];
    expect(middle(plain)[0]).toBeCloseTo(10, 1);
    expect(middle(plain)[1]).toBeCloseTo(-5, 1);
    expect(middle(turned)[0]).toBeCloseTo(10, 1);
    expect(middle(turned)[1]).toBeCloseTo(-5, 1);
    // Turned by 30 degrees a hexagon's corners move: the two outlines are not the same set of points.
    expect(new Set(plain.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`)).size).toBeGreaterThan(0);
    expect(plain.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).sort().join("|")).not.toBe(turned.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).sort().join("|"));
  });

  it("leaves boxes and round shapes to the cheaper drawing", () => {
    expect(shapeMeshFootprint(shape({ kind: "box" }))).toBeNull();
    expect(shapeMeshFootprint(shape({ kind: "cylinder" }))).toBeNull();
  });
});
