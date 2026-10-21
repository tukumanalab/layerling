import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OcctKernel } from "occt-wasm";
import { buildInsetSketchSolid } from "@/lib/cadSketchInset";
import type { SketchPoint, SketchProfile } from "@/types/layerling";

const HEIGHT = 6;
const K = 0.5522847498;
/** What rounding one corner of radius r takes off (outer corner) or adds (inner corner). */
const corner = (r: number) => (1 - Math.PI / 4) * r * r;

function loop(prefix: string, coordinates: Array<[number, number]>): SketchProfile {
  const points: SketchPoint[] = coordinates.map(([x, z], index) => ({ id: `${prefix}${index}`, x, z }));
  return {
    points,
    segments: points.map((point, index) => ({ id: `${prefix}s${index}`, kind: "line" as const, startId: point.id, endId: points[(index + 1) % points.length].id })),
  };
}

/** A 40 x 30 rectangle whose corner (40, 30) is rounded with radius 10 by one Bezier, as the sketch's fillet draws it. */
function roundedRectangle(): SketchProfile {
  const points: SketchPoint[] = [
    { id: "a", x: 0, z: 0 },
    { id: "b", x: 40, z: 0 },
    { id: "c", x: 40, z: 20, mode: "split", handleOut: { x: 40, z: 20 + 10 * K } },
    { id: "d", x: 30, z: 30, mode: "split", handleIn: { x: 30 + 10 * K, z: 30 } },
    { id: "e", x: 0, z: 30 },
  ];
  return {
    points,
    segments: [
      { id: "ab", kind: "line", startId: "a", endId: "b" },
      { id: "bc", kind: "line", startId: "b", endId: "c" },
      { id: "cd", kind: "bezier", startId: "c", endId: "d" },
      { id: "de", kind: "line", startId: "d", endId: "e" },
      { id: "ea", kind: "line", startId: "e", endId: "a" },
    ],
  };
}

/** How many surfaces of each type (1 plane, 2 cylinder, ...) the BREP text lists. */
function surfaceTypes(brep: string) {
  const rows = brep.slice(brep.indexOf("Surfaces"), brep.indexOf("TShapes")).split(String.fromCharCode(10)).map((row) => row.split(" ")[0]);
  const counts: Record<string, number> = {};
  rows.filter((row) => /^\d+$/.test(row)).forEach((row) => { counts[row] = (counts[row] ?? 0) + 1; });
  return counts;
}

describe("a sketch set in from its outlines as an exact solid, with the real OCCT kernel", () => {
  let kernel: OcctKernel;

  beforeAll(async () => {
    const wasm = join(dirname(fileURLToPath(import.meta.resolve("occt-wasm"))), "occt-wasm.wasm");
    kernel = await OcctKernel.init({ wasm });
  });

  it("sets every edge in by the inset and keeps the rounded corner a cylinder", () => {
    const solid = buildInsetSketchSolid(kernel, roundedRectangle(), { distance: 2, radius: 0 }, HEIGHT);
    expect(solid).not.toBeNull();
    // 36 x 26 left, the radius 10 corner now radius 8.
    expect(kernel.getVolume(solid!)).toBeCloseTo((36 * 26 - corner(8)) * HEIGHT, 2);
    expect(surfaceTypes(kernel.toBREP(solid!))["2"]).toBe(1);
  });

  it("rounds the other corners to the radius, each one cylinder", () => {
    const solid = buildInsetSketchSolid(kernel, roundedRectangle(), { distance: 2, radius: 3 }, HEIGHT);
    expect(solid).not.toBeNull();
    expect(kernel.getVolume(solid!)).toBeCloseTo((36 * 26 - corner(8) - 3 * corner(3)) * HEIGHT, 2);
    expect(surfaceTypes(kernel.toBREP(solid!))["2"]).toBe(4);
  });

  it("rounds the inner corner of an L as well", () => {
    const solid = buildInsetSketchSolid(kernel, loop("l", [[0, 0], [40, 0], [40, 20], [20, 20], [20, 40], [0, 40]]), { distance: 0, radius: 3 }, HEIGHT);
    expect(solid).not.toBeNull();
    // Five outer corners take off a corner's worth each, the inner one adds one.
    expect(kernel.getVolume(solid!)).toBeCloseTo((1200 - 4 * corner(3)) * HEIGHT, 2);
    expect(surfaceTypes(kernel.toBREP(solid!))["2"]).toBe(6);
  });

  it("widens an opening by the inset", () => {
    const outer = loop("o", [[0, 0], [40, 0], [40, 40], [0, 40]]);
    const hole = loop("h", [[15, 15], [25, 15], [25, 25], [15, 25]]);
    const profile = { points: [...outer.points, ...hole.points], segments: [...outer.segments, ...hole.segments] };
    const solid = buildInsetSketchSolid(kernel, profile, { distance: 2, radius: 0 }, HEIGHT);
    expect(solid).not.toBeNull();
    expect(kernel.getVolume(solid!)).toBeCloseTo((36 * 36 - 14 * 14) * HEIGHT, 2);
  });

  it("leaves an opening with a radius to the polygon route, which rounds the area as a whole", () => {
    const outer = loop("o", [[0, 0], [40, 0], [40, 40], [0, 40]]);
    const hole = loop("h", [[15, 15], [25, 15], [25, 25], [15, 25]]);
    const profile = { points: [...outer.points, ...hole.points], segments: [...outer.segments, ...hole.segments] };
    expect(buildInsetSketchSolid(kernel, profile, { distance: 2, radius: 1 }, HEIGHT)).toBeNull();
  });

  it("leaves two areas with a radius to the polygon route, which closes the gap between them", () => {
    const left = loop("l", [[0, 0], [10, 0], [10, 10], [0, 10]]);
    const right = loop("r", [[13, 0], [23, 0], [23, 10], [13, 10]]);
    const profile = { points: [...left.points, ...right.points], segments: [...left.segments, ...right.segments] };
    expect(buildInsetSketchSolid(kernel, profile, { distance: 0, radius: 2 }, HEIGHT)).toBeNull();
  });

  it("leaves it to the polygon route when the inset wipes the outline out", () => {
    expect(buildInsetSketchSolid(kernel, loop("s", [[0, 0], [10, 0], [10, 10], [0, 10]]), { distance: 6, radius: 0 }, HEIGHT)).toBeNull();
  });
});
