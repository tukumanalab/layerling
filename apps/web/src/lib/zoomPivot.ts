import * as THREE from "three";

/**
 * How far ahead of the camera the pivot is kept while zooming in at a point that has nothing to
 * zoom towards: the sky above the plate, or a spot past the plate's edge. The wheel moves the camera a
 * share of its distance to the pivot, so a pivot left where it was ended up closer with every notch,
 * the steps shrank and the camera stopped at its closest distance although the way ahead was free.
 */
export const ZOOM_PIVOT_REACH_MM = 50;

/**
 * The pivot to use when the pointer finds no surface: where the old one was if it is still far enough
 * ahead, otherwise on the line of sight, `reach` ahead of the camera, so the camera can go on. The point stays
 * on the line of sight and inside the box the pivot may be in: where the box ends the distance is cut short
 * along the line, never a coordinate at a time, for that turns the view (the camera then looked steeply down
 * near the back edge). Null: leave the pivot alone.
 */
export function pivotKeptAhead(
  camera: THREE.Vector3,
  target: THREE.Vector3,
  forward: THREE.Vector3,
  reach: number,
  limits: { halfWidth: number; halfDepth: number; minY: number; maxY: number } | null,
): THREE.Vector3 | null {
  const distance = camera.distanceTo(target);
  if (distance >= reach) return null;
  let ahead = reach;
  if (limits) {
    const along = (from: number, direction: number, low: number, high: number) => {
      if (Math.abs(direction) < 1e-9) return Number.POSITIVE_INFINITY;
      return Math.max(0, ((direction > 0 ? high : low) - from) / direction);
    };
    ahead = Math.min(
      ahead,
      along(camera.x, forward.x, -limits.halfWidth, limits.halfWidth),
      along(camera.z, forward.z, -limits.halfDepth, limits.halfDepth),
      along(camera.y, forward.y, limits.minY, limits.maxY),
    );
  }
  // At the edge of the box nothing is gained, and the old pivot stays.
  if (!(ahead > distance + 1e-6)) return null;
  return camera.clone().addScaledVector(forward, ahead);
}

/**
 * How far up and down the orbit pivot may go: at least the range it always had, and further to the
 * top of the highest body and the foot of the lowest, so a body set high above the plate can be
 * centred and zoomed into (#425). A body counts as tall as its largest side, as it may lie turned.
 */
export function pivotHeightRange(
  bodies: Iterable<{ elevation: number; extent: number }>,
  base: { minY: number; maxY: number },
  reach?: { minY: number; maxY: number } | null,
): { minY: number; maxY: number } {
  let { minY, maxY } = base;
  for (const body of bodies) {
    minY = Math.min(minY, body.elevation);
    maxY = Math.max(maxY, body.elevation + body.extent);
  }
  if (reach) {
    minY = Math.min(minY, reach.minY);
    maxY = Math.max(maxY, reach.maxY);
  }
  return { minY, maxY };
}

/**
 * How far out to the sides and to the back the orbit pivot may go: at least the plate, and as far as
 * the farthest body, so a design with parts parked beside the plate can be panned and turned about
 * all of them, not only the ones the view was last centred on (#502). A body counts as wide as its
 * largest side, as it may lie turned.
 */
export function pivotPlateReach(
  bodies: Iterable<{ x: number; z: number; extent: number }>,
  plate: { halfWidth: number; halfDepth: number },
): { halfWidth: number; halfDepth: number } {
  let { halfWidth, halfDepth } = plate;
  for (const body of bodies) {
    halfWidth = Math.max(halfWidth, Math.abs(body.x) + body.extent / 2);
    halfDepth = Math.max(halfDepth, Math.abs(body.z) + body.extent / 2);
  }
  return { halfWidth, halfDepth };
}
