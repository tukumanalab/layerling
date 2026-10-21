import { describe, expect, it } from "vitest";
import { mirrorSketchSelection, SKETCH_MIRROR_HORIZONTAL, SKETCH_MIRROR_VERTICAL, sketchMirrorAxisThroughSegment } from "@/lib/sketchMirror";
import type { SketchProfile } from "@/types/layerling";

function idFactory() {
  let next = 0;
  return (prefix: string) => `${prefix}-${(next += 1)}`;
}

/** The right half of a bracket: its first and last point lie on the vertical axis (x = 0). */
const halfOutline: SketchProfile = {
  points: [
    { id: "a", x: 0, z: -20 },
    { id: "b", x: 30, z: -20 },
    { id: "c", x: 30, z: 10 },
    { id: "d", x: 0, z: 10 },
  ],
  segments: [
    { id: "ab", startId: "a", endId: "b" },
    { id: "bc", startId: "b", endId: "c" },
    { id: "cd", startId: "c", endId: "d" },
  ],
};

const everything = { kind: "multiple" as const, pointIds: ["a", "b", "c", "d"], segmentIds: ["ab", "bc", "cd"] };

describe("mirror in the sketch (#512)", () => {
  it("copies the selection to the other side of the vertical axis, with the originals kept", () => {
    const result = mirrorSketchSelection(halfOutline, everything, SKETCH_MIRROR_VERTICAL, idFactory())!;
    const at = (x: number, z: number) => result.profile.points.filter((point) => Math.abs(point.x - x) < 1e-9 && Math.abs(point.z - z) < 1e-9);
    expect(at(30, -20)).toHaveLength(1);
    expect(at(-30, -20)).toHaveLength(1);
    expect(at(-30, 10)).toHaveLength(1);
  });

  it("shares the points on the axis, so the two halves make one closed outline", () => {
    const result = mirrorSketchSelection(halfOutline, everything, SKETCH_MIRROR_VERTICAL, idFactory())!;
    expect(result.profile.points).toHaveLength(6);
    expect(result.profile.segments).toHaveLength(6);
    const degree = new Map<string, number>();
    result.profile.segments.forEach((segment) => {
      degree.set(segment.startId, (degree.get(segment.startId) ?? 0) + 1);
      degree.set(segment.endId, (degree.get(segment.endId) ?? 0) + 1);
    });
    expect([...degree.values()].every((count) => count === 2)).toBe(true);
  });

  it("returns only what was added, to select it", () => {
    const result = mirrorSketchSelection(halfOutline, everything, SKETCH_MIRROR_VERTICAL, idFactory())!;
    expect(result.pointIds).toHaveLength(2);
    expect(result.segmentIds).toHaveLength(3);
    expect(result.pointIds.some((id) => ["a", "b", "c", "d"].includes(id))).toBe(false);
  });

  it("mirrors top-bottom across the horizontal axis", () => {
    const result = mirrorSketchSelection(halfOutline, { kind: "point", id: "b" }, SKETCH_MIRROR_HORIZONTAL, idFactory())!;
    const copy = result.profile.points.find((point) => point.id === result.pointIds[0])!;
    expect(copy.x).toBeCloseTo(30);
    expect(copy.z).toBeCloseTo(20);
  });

  it("mirrors across a straight line of the sketch, curve handles included", () => {
    const profile: SketchProfile = {
      points: [
        { id: "p", x: 10, z: 0, handleOut: { x: 14, z: 0 } },
        { id: "q", x: 10, z: 10 },
        { id: "m", x: 20, z: 0 },
        { id: "n", x: 20, z: 10 },
      ],
      segments: [
        { id: "pq", startId: "p", endId: "q" },
        { id: "axis", startId: "m", endId: "n" },
      ],
    };
    const axis = sketchMirrorAxisThroughSegment(profile, "axis")!;
    const result = mirrorSketchSelection(profile, { kind: "point", id: "p" }, axis, idFactory())!;
    const copy = result.profile.points.find((point) => point.id === result.pointIds[0])!;
    expect(copy.x).toBeCloseTo(30);
    expect(copy.z).toBeCloseTo(0);
    expect(copy.handleOut?.x).toBeCloseTo(26);
  });

  it("mirrors across a slanted line", () => {
    const profile: SketchProfile = {
      points: [{ id: "p", x: 10, z: 0 }, { id: "m", x: 0, z: 0 }, { id: "n", x: 10, z: 10 }],
      segments: [{ id: "axis", startId: "m", endId: "n" }],
    };
    const result = mirrorSketchSelection(profile, { kind: "point", id: "p" }, sketchMirrorAxisThroughSegment(profile, "axis")!, idFactory())!;
    const copy = result.profile.points.find((point) => point.id === result.pointIds[0])!;
    expect(copy.x).toBeCloseTo(0);
    expect(copy.z).toBeCloseTo(10);
  });

  it("takes no curve or point as an axis", () => {
    const profile: SketchProfile = {
      points: [{ id: "m", x: 0, z: 0, handleOut: { x: 5, z: 5 } }, { id: "n", x: 10, z: 10 }],
      segments: [{ id: "curve", startId: "m", endId: "n", kind: "bezier" }],
    };
    expect(sketchMirrorAxisThroughSegment(profile, "curve")).toBeNull();
    expect(sketchMirrorAxisThroughSegment(profile, "missing")).toBeNull();
  });

  it("does not lay a line that lies on the axis twice", () => {
    const profile: SketchProfile = {
      points: [{ id: "a", x: 0, z: 0 }, { id: "b", x: 0, z: 10 }],
      segments: [{ id: "ab", startId: "a", endId: "b" }],
    };
    expect(mirrorSketchSelection(profile, { kind: "segment", id: "ab" }, SKETCH_MIRROR_VERTICAL, idFactory())).toBeNull();
  });

  it("returns nothing without a selection or with only a picture selected", () => {
    expect(mirrorSketchSelection(halfOutline, null, SKETCH_MIRROR_VERTICAL, idFactory())).toBeNull();
    const withImage: SketchProfile = { ...halfOutline, images: [{ id: "img", name: "ref", dataUrl: "data:", mimeType: "image/png", pixelWidth: 1, pixelHeight: 1, x: 5, z: 5, width: 4, depth: 4 }] };
    expect(mirrorSketchSelection(withImage, { kind: "image", id: "img" }, SKETCH_MIRROR_VERTICAL, idFactory())).toBeNull();
  });
});
