import manifoldModule, { type ManifoldToplevel } from "manifold-3d";
import { beforeAll, describe, expect, it } from "vitest";
import { iconLayerKeyrings, iconLayerProfile, iconLayersOf, ICON_TAG_LAYERS } from "@/lib/iconTag";
import { iconEarOffset, iconKeyringFor, isSketchKeyring, keyringSketchProfile, normalizeSketchKeyring } from "@/lib/sketchKeyring";
import { keyringEarRadius } from "@/lib/textGeometry";
import type { SketchPoint, SketchProfile, SketchSegment, WorkplaneShape } from "@/types/layerling";

let runtime: ManifoldToplevel;

beforeAll(async () => {
  runtime = await manifoldModule();
  runtime.setup();
});

/** A closed rectangle as a sketch. */
function rectangle(x0: number, z0: number, x1: number, z1: number): SketchProfile {
  const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const points: SketchPoint[] = corners.map(([x, z], index) => ({ id: `p${index}`, x, z, mode: "corner" }));
  const segments: SketchSegment[] = corners.map((_, index) => ({ id: `s${index}`, startId: `p${index}`, endId: `p${(index + 1) % 4}`, kind: "line" }));
  return { points, segments };
}

function polygonArea(profile: SketchProfile) {
  const byId = new Map(profile.points.map((point) => [point.id, point]));
  const next = new Map(profile.segments.map((segment) => [segment.startId, segment.endId]));
  const seen = new Set<string>();
  let total = 0;
  profile.points.forEach((start) => {
    if (seen.has(start.id)) return;
    let sum = 0;
    let id = start.id;
    do {
      seen.add(id);
      const a = byId.get(id)!;
      const b = byId.get(next.get(id)!)!;
      sum += a.x * b.z - b.x * a.z;
      id = next.get(id)!;
    } while (id !== start.id);
    total += sum / 2;
  });
  return total;
}

function bounds(profile: SketchProfile) {
  const xs = profile.points.map((point) => point.x);
  const zs = profile.points.map((point) => point.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

describe("key ring hole of a sketch (#391)", () => {
  it("normalizes a stored hole and refuses what is not one", () => {
    expect(normalizeSketchKeyring({ side: "left", diameter: 3, x: -12, z: 0 })).toEqual({ side: "left", diameter: 3, x: -12, z: 0 });
    expect(normalizeSketchKeyring({ side: "up", diameter: 50, x: 1, z: 2, ear: true })).toEqual({ side: "left", diameter: 20, x: 1, z: 2, ear: true });
    expect(normalizeSketchKeyring({ side: "left", diameter: 0, x: 1, z: 2 })).toBeUndefined();
    expect(normalizeSketchKeyring({ side: "left", diameter: 3, x: Number.NaN, z: 2 })).toBeUndefined();
    expect(normalizeSketchKeyring(null)).toBeUndefined();
    expect(isSketchKeyring({ side: "top", diameter: 3, x: 0, z: -9 })).toBe(true);
    expect(isSketchKeyring({ side: "bottom", diameter: 3, x: 0, z: -9 })).toBe(false);
    expect(isSketchKeyring({ side: "top", diameter: 40, x: 0, z: -9 })).toBe(false);
  });

  it("puts the hole's edge 2 mm beyond the widest layer, in the middle of its side", () => {
    const area = rectangle(-10, -5, 10, 5);
    // diameter 4, the layers reach 3 mm: the middle lies 3 + 2 + 2 beyond the icon
    expect(iconKeyringFor(area, 3, "left", 4, true)).toEqual({ side: "left", diameter: 4, x: -17, z: 0, ear: true });
    expect(iconKeyringFor(area, 3, "right", 4, false)).toEqual({ side: "right", diameter: 4, x: 17, z: 0 });
    expect(iconKeyringFor(area, 3, "top", 4, true)).toEqual({ side: "top", diameter: 4, x: 0, z: -12, ear: true });
    expect(iconKeyringFor({ points: [], segments: [] }, 3, "left", 4, true)).toBeNull();
  });

  it("gives every layer the hole and the bottom one the ear", () => {
    const area = rectangle(-10, -5, 10, 5);
    const holes = iconLayerKeyrings(area, ICON_TAG_LAYERS, { side: "left", diameter: 3 });
    expect(holes).toHaveLength(ICON_TAG_LAYERS.length);
    holes.forEach((hole, index) => {
      expect(hole).toBeDefined();
      expect(hole!.x).toBeCloseTo(holes[0]!.x);
      expect(Boolean(hole!.ear)).toBe(index === holes.length - 1);
    });
    expect(iconLayerKeyrings(area, ICON_TAG_LAYERS, null).every((hole) => hole === undefined)).toBe(true);
  });

  it("moves the layer with the ear back by half of what the ear adds", () => {
    const area = rectangle(-10, -5, 10, 5);
    const keyring = iconKeyringFor(area, 3, "left", 4, true)!;
    const offset = iconEarOffset(area, 3, keyring);
    // The ear reaches 3.75 mm round the middle at -17: out to -20.75, the plate itself to -13.
    expect(offset.x).toBeCloseTo((-20.75 + 13) / 2);
    // On the plate's depth (-8..8) the ear (-3.75..3.75) adds nothing.
    expect(offset.z).toBeCloseTo(0);
    expect(iconEarOffset(area, 3, { ...keyring, ear: undefined })).toEqual({ x: 0, z: 0 });
  });

  it("builds the outline with the tab and the hole through the plate", () => {
    const area = rectangle(-10, -5, 10, 5);
    const hole = iconKeyringFor(area, 0, "left", 4, true)!;
    const plain = { ...area };
    const withEar = keyringSketchProfile(runtime, { ...plain, keyring: hole })!;
    expect(withEar).not.toBeNull();
    const extent = bounds(withEar);
    // The tab reaches out to the middle of the hole less the ear's radius.
    expect(extent.minX).toBeCloseTo(hole.x - keyringEarRadius(4), 3);
    expect(extent.maxX).toBeCloseTo(10, 3);
    // The area has the hole's disc cut out of the plate and the tab (two loops: outline and hole).
    const withoutEar = keyringSketchProfile(runtime, { ...plain, keyring: { ...hole, ear: undefined } })!;
    expect(polygonArea(withEar)).toBeGreaterThan(polygonArea(withoutEar));
  });

  it("cuts the hole on every layer and leaves the area otherwise as it was", () => {
    const area = rectangle(-10, -5, 10, 5);
    const hole = { side: "left" as const, diameter: 4, x: -6, z: 0 };
    const holed = keyringSketchProfile(runtime, { ...area, keyring: hole })!;
    // 20 x 10 plate less a disc of radius 2 (a 64-sided one, a little less than pi r^2).
    expect(polygonArea(holed)).toBeCloseTo(200 - Math.PI * 4, 0);
    expect(keyringSketchProfile(runtime, area)).toBeNull();
  });

  it("reads the hole back from the layers of an icon tag", () => {
    const area = rectangle(-10, -5, 10, 5);
    const holes = iconLayerKeyrings(area, ICON_TAG_LAYERS, { side: "top", diameter: 5 });
    const shapes = ICON_TAG_LAYERS.map((layer, index) => ({
      id: `layer-${index}`,
      name: "Icon",
      kind: "mesh",
      color: layer.color,
      x: 0,
      z: 0,
      size: 1,
      width: 20,
      depth: 10,
      height: layer.height,
      elevation: ICON_TAG_LAYERS.slice(index + 1).reduce((sum, below) => sum + below.height, 0),
      rotation: 0,
      sketchProfile: iconLayerProfile(area, layer, holes[index]),
      sketchOperation: "extrude",
    }) as unknown as WorkplaneShape);
    const stack = iconLayersOf(shapes);
    expect(stack).not.toBeNull();
    expect(stack!.keyring).toEqual({ side: "top", diameter: 5 });
    expect(iconLayersOf(shapes.map((shape, index) => ({ ...shape, sketchProfile: iconLayerProfile(area, ICON_TAG_LAYERS[index]) })))!.keyring).toBeNull();
  });
});
