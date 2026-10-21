import type { SliceVertex } from "@/lib/sketchSlice";

/** A path with more pieces than this is thinned: a see-through view of a huge mesh must stay drawable. */
export const MAX_SEE_THROUGH_SEGMENTS = 30000;

const keyOf = (x: number, h: number, z: number) => `${Math.round(x * 1000)},${Math.round(h * 1000)},${Math.round(z * 1000)}`;

type EdgeUse = { a: number; b: number; first: number; second: number; more: boolean };

/**
 * The edges of a body seen through, projected onto the sketch plane (#354): every edge where the surface
 * turns by more than `angleDegrees`, every edge on the outline of the body as seen from the plane's normal,
 * and every open edge. The vertices carry the plane's own coordinates (`x`, `z` along it, `h` above it); the
 * result is an SVG path of single lines in the same coordinates, the way the sketch is drawn.
 */
export function projectedEdgesPath(
  vertices: readonly SliceVertex[],
  faces: ReadonlyArray<readonly [number, number, number]>,
  angleDegrees = 30,
): string {
  // Weld by position first: the vertices of an imported mesh are often repeated for every triangle.
  const welded = new Map<string, number>();
  const place = (index: number) => {
    const vertex = vertices[index];
    const key = keyOf(vertex.x, vertex.h, vertex.z);
    let id = welded.get(key);
    if (id === undefined) {
      id = welded.size;
      welded.set(key, id);
    }
    return id;
  };
  const points: SliceVertex[] = [];
  const normals: Array<[number, number, number] | null> = [];
  const edges = new Map<string, EdgeUse>();
  faces.forEach(([ia, ib, ic], face) => {
    if (!vertices[ia] || !vertices[ib] || !vertices[ic]) {
      normals.push(null);
      return;
    }
    const ids = [place(ia), place(ib), place(ic)];
    [ia, ib, ic].forEach((index, corner) => {
      if (points[ids[corner]] === undefined) points[ids[corner]] = vertices[index];
    });
    const a = vertices[ia];
    const b = vertices[ib];
    const c = vertices[ic];
    const ux = b.x - a.x;
    const uh = b.h - a.h;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vh = c.h - a.h;
    const vz = c.z - a.z;
    let nx = uh * vz - uz * vh;
    let nh = uz * vx - ux * vz;
    let nz = ux * vh - uh * vx;
    const length = Math.hypot(nx, nh, nz);
    if (length < 1e-12 || ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) {
      normals.push(null);
      return;
    }
    nx /= length;
    nh /= length;
    nz /= length;
    normals.push([nx, nh, nz]);
    for (let corner = 0; corner < 3; corner += 1) {
      const from = ids[corner];
      const to = ids[(corner + 1) % 3];
      const key = from < to ? `${from}_${to}` : `${to}_${from}`;
      const use = edges.get(key);
      if (!use) edges.set(key, { a: Math.min(from, to), b: Math.max(from, to), first: face, second: -1, more: false });
      else if (use.second < 0) use.second = face;
      else use.more = true;
    }
  });

  const collect = (limit: number) => {
    const cosLimit = Math.cos((limit * Math.PI) / 180);
    const pieces: Array<[number, number]> = [];
    edges.forEach((use) => {
      let keep = use.second < 0 || use.more;
      if (!keep) {
        const n1 = normals[use.first];
        const n2 = normals[use.second];
        if (n1 && n2) {
          const dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
          // A turn sharper than the limit, or the outline of the body as seen from the plane: one side faces it, the other away.
          keep = dot < cosLimit || n1[1] * n2[1] < -1e-9;
        }
      }
      if (keep) pieces.push([use.a, use.b]);
    });
    return pieces;
  };
  let pieces = collect(angleDegrees);
  if (pieces.length > MAX_SEE_THROUGH_SEGMENTS) pieces = collect(60);
  if (pieces.length > MAX_SEE_THROUGH_SEGMENTS) pieces = pieces.slice(0, MAX_SEE_THROUGH_SEGMENTS);
  const fixed = (value: number) => Number(value.toFixed(3));
  return pieces
    .map(([from, to]) => `M${fixed(points[from].x)} ${fixed(points[from].z)}L${fixed(points[to].x)} ${fixed(points[to].z)}`)
    .join("");
}
