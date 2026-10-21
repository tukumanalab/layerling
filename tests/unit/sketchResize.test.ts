import { describe, expect, it } from "vitest";
import { sketchBodyStretch, stretchedSketchProfile } from "@/lib/sketchResize";
import type { SketchProfile, WorkplaneShape } from "@/types/layerling";

const profile: SketchProfile = {
  points: [
    { id: "a", x: 0, z: 0 },
    { id: "b", x: 40, z: 0, handleOut: { x: 50, z: 10 } },
    { id: "c", x: 40, z: 20, handleIn: { x: 30, z: 30 } },
  ],
  segments: [
    { id: "ab", startId: "a", endId: "b", kind: "line" },
    { id: "bc", startId: "b", endId: "c", kind: "bezier" },
    { id: "ca", startId: "c", endId: "a", kind: "line" },
  ],
};

function body(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id: "s", name: "Sketch extrusion", kind: "mesh", color: "#d41721", x: 0, z: 0, elevation: 0, size: 40,
    width: 40, depth: 20, height: 10, rotation: 0, locked: false, hidden: false,
    sketchProfile: profile, sketchOperation: "extrude", cadBrep: "brep",
    cadBrepFrame: { width: 40, depth: 20, height: 10 } as WorkplaneShape["cadBrepFrame"],
    ...overrides,
  } as WorkplaneShape;
}

describe("resizing a sketch body (#115)", () => {
  it("notices a body resized since its exact body was built, and only then", () => {
    expect(sketchBodyStretch(body())).toBeNull();
    expect(sketchBodyStretch(body({ height: 30 }))).toEqual({ x: 1, z: 1, height: 30 });
    expect(sketchBodyStretch(body({ width: 80, depth: 10 }))).toEqual({ x: 2, z: 0.5, height: 10 });
    // A revolved sketch, a filleted body or one without its exact body is left as it is.
    expect(sketchBodyStretch(body({ height: 30, sketchOperation: "revolve" }))).toBeNull();
    expect(sketchBodyStretch(body({ height: 30, edgeTreatments: [{ kind: "fillet", amount: 1, edgeCount: 1 }] }))).toBeNull();
    expect(sketchBodyStretch(body({ height: 30, cadBrep: undefined }))).toBeNull();
  });

  it("stretches the sketch of a face tool body so the body, set in again, takes the new size", () => {
    // A 60 x 30 rectangle built 3 mm inside is a 54 x 24 body. Pulled to 64 wide, the sketch must reach 70.
    const rectangle: SketchProfile = {
      points: [{ id: "a", x: 0, z: 0 }, { id: "b", x: 60, z: 0 }, { id: "c", x: 60, z: 30 }, { id: "d", x: 0, z: 30 }],
      segments: [{ id: "ab", startId: "a", endId: "b" }, { id: "bc", startId: "b", endId: "c" }, { id: "cd", startId: "c", endId: "d" }, { id: "da", startId: "d", endId: "a" }],
      inset: { distance: 3, radius: 2 },
    };
    const stretch = sketchBodyStretch(body({ sketchProfile: rectangle, width: 64, depth: 24, cadBrepFrame: { width: 54, depth: 24, height: 10 } as WorkplaneShape["cadBrepFrame"] }));
    expect(stretch?.x).toBeCloseTo(70 / 60, 9);
    expect(stretch?.z).toBeCloseTo(1, 9);
    expect(stretchedSketchProfile(rectangle, 2, 1).inset).toEqual({ distance: 3, radius: 2 });
  });

  it("measures the closed outlines only, not a construction line reaching past them", () => {
    const rectangle: SketchProfile = {
      points: [
        { id: "a", x: 0, z: 0 }, { id: "b", x: 60, z: 0 }, { id: "c", x: 60, z: 30 }, { id: "d", x: 0, z: 30 },
        { id: "e", x: -20, z: 15 }, { id: "f", x: 80, z: 15 },
      ],
      segments: [
        { id: "ab", startId: "a", endId: "b" }, { id: "bc", startId: "b", endId: "c" }, { id: "cd", startId: "c", endId: "d" }, { id: "da", startId: "d", endId: "a" },
        { id: "ef", startId: "e", endId: "f", construction: true },
      ],
      inset: { distance: 3, radius: 0 },
    };
    const stretch = sketchBodyStretch(body({ sketchProfile: rectangle, width: 64, depth: 24, cadBrepFrame: { width: 54, depth: 24, height: 10 } as WorkplaneShape["cadBrepFrame"] }));
    expect(stretch?.x).toBeCloseTo(70 / 60, 9);
  });

  it("measures what the inset took off a sketch with slanted sides, not twice the inset", () => {
    // A triangle 20 wide set in by 2 is 13.07 wide, 6.93 narrower than its sketch, not 4.
    const triangle: SketchProfile = {
      points: [{ id: "a", x: 0, z: 0 }, { id: "b", x: 20, z: 0 }, { id: "c", x: 10, z: 17.32 }],
      segments: [{ id: "ab", startId: "a", endId: "b" }, { id: "bc", startId: "b", endId: "c" }, { id: "ca", startId: "c", endId: "a" }],
      inset: { distance: 2, radius: 0 },
    };
    const stretch = sketchBodyStretch(body({ sketchProfile: triangle, width: 26.14, depth: 10.39, cadBrepFrame: { width: 13.07, depth: 10.39, height: 10 } as WorkplaneShape["cadBrepFrame"] }));
    expect(stretch?.x).toBeCloseTo((26.14 + 6.93) / 20, 6);
  });

  it("stretches points and curve handles about the middle of the sketch", () => {
    const stretched = stretchedSketchProfile(profile, 2, 0.5);
    expect(stretched.points.map((point) => [point.x, point.z])).toEqual([[-20, 5], [60, 5], [60, 15]]);
    expect(stretched.points[1].handleOut).toEqual({ x: 80, z: 10 });
    expect(stretched.points[2].handleIn).toEqual({ x: 40, z: 20 });
    expect(stretched.segments).toEqual(profile.segments);
    // The original is left alone.
    expect(profile.points[1].x).toBe(40);
  });
});
