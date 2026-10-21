/*
 * The diameters of a round tube or ring (#384, forum). Outer diameter, inner diameter and wall are
 * one fact seen three ways - outer = inner + 2 x wall - and typing any of them must give the same
 * tube whatever was typed before. So each entry changes what it names and lets the others follow:
 * the outer diameter keeps the bore (the wall gives way), the inner diameter keeps the outer one (the
 * wall gives way) unless the bore does not fit inside it, and then the outer one grows by the wall.
 */

/** The thinnest wall a tube can have, in mm. */
export const MIN_TUBE_WALL = 0.5;

export type TubeDiameters = { outer: number; wall: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** The thickest wall an outer diameter allows: a little less than the radius, so a bore is left. */
export function tubeWallLimit(outer: number) {
  return Math.max(MIN_TUBE_WALL, outer / 2 - 0.1);
}

/** The bore of a tube of this outer diameter and wall. */
export function tubeInnerDiameter(outer: number, wall: number) {
  return Math.max(0.2, outer - 2 * Math.min(wall, tubeWallLimit(outer)));
}

/** The outer diameter was typed: the bore stays, the wall changes (down to the thinnest, then the bore shrinks). */
export function tubeAfterOuter(outer: number, inner: number): TubeDiameters {
  return { outer, wall: clamp((outer - inner) / 2, MIN_TUBE_WALL, tubeWallLimit(outer)) };
}

/** The inner diameter was typed: the outer one stays; if the bore does not fit in it, the outer one grows by the wall. */
export function tubeAfterInner(inner: number, outer: number, wall: number): TubeDiameters {
  if (inner <= outer - 2 * MIN_TUBE_WALL) {
    return { outer, wall: clamp((outer - inner) / 2, MIN_TUBE_WALL, tubeWallLimit(outer)) };
  }
  const keptWall = Math.max(MIN_TUBE_WALL, wall);
  return { outer: inner + 2 * keptWall, wall: keptWall };
}
