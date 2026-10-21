/**
 * The size of the shape library that the Shapes button opens (#505). Without a stored size the stylesheet decides
 * (columns by toolbar size, a height of at most 650 px); once someone has pulled an edge, the width and height
 * they chose are kept in this browser.
 */
export type ShapeMenuSize = { width: number | null; height: number | null };

/** The narrowest and the widest the panel can be pulled, in the panel's own pixels (before the toolbar scale). */
export const SHAPE_MENU_MIN_WIDTH = 120;
export const SHAPE_MENU_MAX_WIDTH = 2400;
export const SHAPE_MENU_MIN_HEIGHT = 180;
export const SHAPE_MENU_MAX_HEIGHT = 2400;

/**
 * Below this width the names are left off and only the pictures stay, as in Tinkercad. At 300 px a column with
 * its picture and a name still fits; narrower, the names would be cut off.
 */
export const SHAPE_MENU_ICONS_ONLY_BELOW = 300;

export function clampShapeMenuLength(value: number, min: number, max: number) {
  return Math.round(Math.min(max, Math.max(min, value)));
}

export function shapeMenuShowsNames(width: number | null) {
  return width === null || width >= SHAPE_MENU_ICONS_ONLY_BELOW;
}

/** A stored size, or nothing for each side that is missing or not a usable number. */
export function parseShapeMenuSize(stored: string | null): ShapeMenuSize {
  const none: ShapeMenuSize = { width: null, height: null };
  if (!stored) return none;
  try {
    const value = JSON.parse(stored) as { width?: unknown; height?: unknown } | null;
    if (!value || typeof value !== "object") return none;
    const usable = (side: unknown, min: number, max: number) =>
      typeof side === "number" && Number.isFinite(side) ? clampShapeMenuLength(side, min, max) : null;
    return {
      width: usable(value.width, SHAPE_MENU_MIN_WIDTH, SHAPE_MENU_MAX_WIDTH),
      height: usable(value.height, SHAPE_MENU_MIN_HEIGHT, SHAPE_MENU_MAX_HEIGHT),
    };
  } catch {
    return none;
  }
}

export function serializeShapeMenuSize(size: ShapeMenuSize): string | null {
  if (size.width === null && size.height === null) return null;
  return JSON.stringify(size);
}
