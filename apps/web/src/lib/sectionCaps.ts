import * as THREE from "three";
import type { SectionLoop, SectionPoint } from "@/lib/sectionSvg";
import { loopArea } from "@/lib/sectionSvg";

/**
 * The cut face of the section view (#516): where the plane goes through a solid, the cut is filled, so a
 * solid and a hole no longer look the same inside. The outlines come from the same bodies as the section
 * SVG - holes already taken out of the solids, so a hole shows as an inner outline - and are turned into
 * triangles here: an outline inside another is a hole of it, one inside that a body again, and so on.
 */
export type SectionCapMesh = { points: SectionPoint[]; triangles: number[] };

function contains(outer: readonly SectionPoint[], point: SectionPoint) {
  let inside = false;
  for (let index = 0, last = outer.length - 1; index < outer.length; last = index, index += 1) {
    const a = outer[index];
    const b = outer[last];
    if ((a.v > point.v) !== (b.v > point.v) && point.u < ((b.u - a.u) * (point.v - a.v)) / (b.v - a.v) + a.u) inside = !inside;
  }
  return inside;
}

export function sectionCapMesh(loops: readonly SectionLoop[]): SectionCapMesh {
  const usable = loops
    .filter((loop) => loop.closed && loop.points.length >= 3)
    .map((loop) => ({ points: loop.points, area: Math.abs(loopArea(loop.points)) }))
    .filter((loop) => loop.area > 1e-9);
  // Each outline knows the outlines around it; their number says whether it is a rim (even) or a hole (odd).
  const parents = usable.map((loop, index) =>
    usable
      .map((other, otherIndex) => ({ other, otherIndex }))
      .filter(({ other, otherIndex }) => otherIndex !== index && other.area > loop.area && contains(other.points, loop.points[0]))
      .sort((a, b) => a.other.area - b.other.area),
  );
  const points: SectionPoint[] = [];
  const triangles: number[] = [];
  usable.forEach((loop, index) => {
    if (parents[index].length % 2 !== 0) return;
    const holes = usable.filter((_, holeIndex) => parents[holeIndex].length % 2 === 1 && parents[holeIndex][0].otherIndex === index);
    const contour = loop.points.map((point) => new THREE.Vector2(point.u, point.v));
    const holeContours = holes.map((hole) => hole.points.map((point) => new THREE.Vector2(point.u, point.v)));
    const faces = THREE.ShapeUtils.triangulateShape(contour, holeContours);
    const base = points.length;
    points.push(...loop.points, ...holes.flatMap((hole) => hole.points));
    faces.forEach(([a, b, c]) => triangles.push(base + a, base + b, base + c));
  });
  return { points, triangles };
}

/** The area the cap covers, for tests and for telling an empty cut from a filled one. */
export function sectionCapArea(mesh: SectionCapMesh) {
  let area = 0;
  for (let index = 0; index + 2 < mesh.triangles.length; index += 3) {
    const a = mesh.points[mesh.triangles[index]];
    const b = mesh.points[mesh.triangles[index + 1]];
    const c = mesh.points[mesh.triangles[index + 2]];
    area += Math.abs((b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u)) / 2;
  }
  return area;
}
