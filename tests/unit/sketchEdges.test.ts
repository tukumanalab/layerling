import { describe, expect, it } from "vitest";
import { projectedEdgesPath, MAX_SEE_THROUGH_SEGMENTS } from "@/lib/sketchEdges";

type V = { x: number; h: number; z: number };

/** A cube of 10 mm with its corner at the origin: 8 corners, 12 triangles (two on every face). */
function cube() {
  const vertices: V[] = [];
  for (const x of [0, 10]) for (const h of [0, 10]) for (const z of [0, 10]) vertices.push({ x, h, z });
  const at = (x: number, h: number, z: number) => (x ? 4 : 0) + (h ? 2 : 0) + (z ? 1 : 0);
  const quad = (a: number, b: number, c: number, d: number): Array<[number, number, number]> => [[a, b, c], [a, c, d]];
  const faces = [
    ...quad(at(0, 0, 0), at(0, 0, 1), at(1, 0, 1), at(1, 0, 0)),
    ...quad(at(0, 1, 0), at(1, 1, 0), at(1, 1, 1), at(0, 1, 1)),
    ...quad(at(0, 0, 0), at(1, 0, 0), at(1, 1, 0), at(0, 1, 0)),
    ...quad(at(0, 0, 1), at(0, 1, 1), at(1, 1, 1), at(1, 0, 1)),
    ...quad(at(0, 0, 0), at(0, 1, 0), at(0, 1, 1), at(0, 0, 1)),
    ...quad(at(1, 0, 0), at(1, 0, 1), at(1, 1, 1), at(1, 1, 0)),
  ];
  return { vertices, faces };
}

const pieces = (path: string) => (path.match(/M/g) ?? []).length;

describe("the edges of a body seen through the sketch plane (#354)", () => {
  it("draws the twelve edges of a cube and not the diagonals of its faces", () => {
    const { vertices, faces } = cube();
    expect(pieces(projectedEdgesPath(vertices, faces))).toBe(12);
  });

  it("draws nothing for a mesh without triangles", () => {
    expect(projectedEdgesPath([], [])).toBe("");
  });

  it("draws the outline of a sphere as seen from the plane, although no edge turns sharply", () => {
    // A UV sphere of 24 x 12 facets: neighbouring facets turn by 15 degrees at most, below the limit of 30.
    const vertices: V[] = [];
    const faces: Array<[number, number, number]> = [];
    const rings = 12;
    const around = 24;
    for (let r = 0; r <= rings; r += 1) {
      const polar = (Math.PI * r) / rings;
      for (let a = 0; a < around; a += 1) {
        const azimuth = (2 * Math.PI * a) / around;
        vertices.push({ x: 10 * Math.sin(polar) * Math.cos(azimuth), h: 10 * Math.cos(polar), z: 10 * Math.sin(polar) * Math.sin(azimuth) });
      }
    }
    for (let r = 0; r < rings; r += 1) {
      for (let a = 0; a < around; a += 1) {
        const next = (a + 1) % around;
        const p = r * around + a;
        const q = r * around + next;
        const p2 = (r + 1) * around + a;
        const q2 = (r + 1) * around + next;
        if (r > 0) faces.push([p, p2, q]);
        if (r < rings - 1) faces.push([q, p2, q2]);
      }
    }
    const path = projectedEdgesPath(vertices, faces);
    // The seam where the facets turn from facing the plane to facing away makes a ring of edges.
    expect(pieces(path)).toBeGreaterThanOrEqual(12);
    expect(pieces(path)).toBeLessThan(faces.length * 1.5 / 3);
  });

  it("keeps a mesh of many triangles drawable", () => {
    // Many small facets all turning 90 degrees: more edges than the limit, thinned to it.
    const vertices: V[] = [];
    const faces: Array<[number, number, number]> = [];
    const columns = 200;
    for (let i = 0; i < columns * 200; i += 1) {
      const x = (i % columns) * 2;
      const z = Math.floor(i / columns) * 2;
      const h = (i % 2) * 5; // a comb: every neighbour is 5 mm higher or lower
      vertices.push({ x, h, z });
    }
    for (let row = 0; row < 199; row += 1) {
      for (let col = 0; col < columns - 1; col += 1) {
        const a = row * columns + col;
        faces.push([a, a + 1, a + columns], [a + 1, a + columns + 1, a + columns]);
      }
    }
    const started = performance.now();
    const path = projectedEdgesPath(vertices, faces);
    expect(pieces(path)).toBeLessThanOrEqual(MAX_SEE_THROUGH_SEGMENTS);
    expect(performance.now() - started).toBeLessThan(4000);
  });
});
