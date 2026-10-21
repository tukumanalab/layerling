import { describe, expect, it } from "vitest";
import { sketchReferenceShapeOnWorkplane } from "@/lib/editorSketchCad";
import { REVOLVE_REFERENCE_WORKPLANE, revolveBodyStandsUpright } from "@/lib/placementWorkplane";
import type { WorkplaneShape } from "@/types/layerling";

function box(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return { id: "box", name: "Box", kind: "box", color: "#ff9e2c", x: 0, z: 0, elevation: 0, size: 60, width: 60, depth: 40, height: 10, rotation: 0, locked: false, hidden: false, ...overrides };
}

describe("the other bodies in a revolve sketch (#525)", () => {
  it("shows a plate from the front: its width across and its height up, not its depth", () => {
    const shown = sketchReferenceShapeOnWorkplane(box(), REVOLVE_REFERENCE_WORKPLANE);
    expect(shown.width).toBeCloseTo(60);
    // The sketch's z runs down the screen: the 10 mm of height are 10 mm of sketch depth, from the ground (0) upwards (negative).
    expect(shown.depth).toBeCloseTo(10);
    expect(shown.z).toBeCloseTo(-5);
    expect(shown.x).toBeCloseTo(0);
  });

  it("puts a body that stands on the plate above it, and follows its place across", () => {
    const shown = sketchReferenceShapeOnWorkplane(box({ x: 40, z: 15, elevation: 10, width: 20, depth: 20, height: 25 }), REVOLVE_REFERENCE_WORKPLANE);
    expect(shown.x).toBeCloseTo(40);
    expect(shown.width).toBeCloseTo(20);
    expect(shown.depth).toBeCloseTo(25);
    expect(shown.z).toBeCloseTo(-(10 + 25 / 2));
  });
});

describe("a revolved body opened again for editing (#525)", () => {
  it("stands upright when it has no turn or only one about the vertical", () => {
    expect(revolveBodyStandsUpright({ rotation: 0 })).toBe(true);
    expect(revolveBodyStandsUpright({ rotation: 90, rotationX: 0, rotationZ: 0 })).toBe(true);
  });

  it("does not when it lies down or leans", () => {
    expect(revolveBodyStandsUpright({ rotation: 0, rotationX: 90 })).toBe(false);
    expect(revolveBodyStandsUpright({ rotation: 0, rotationZ: 45 })).toBe(false);
  });
});
