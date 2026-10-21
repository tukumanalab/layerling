export type ScreenPoint = { x: number; y: number };

/** The screen distance the alignment handles of one axis keep from each other at least (a handle is about 18 px wide). */
export const MIN_ALIGN_HANDLE_GAP = 28;

/**
 * The three alignment handles of one axis stand where the parts will line up: at the minimum, the middle
 * and the maximum of the selection. For a small part, or far away, they land a few pixels apart and run
 * into one blob that cannot be picked (#486). This pushes the outer two away from the middle, along the
 * line they already follow, until each is `gap` pixels from it. The middle stays where it is, and handles
 * that are far enough apart are not touched. `axisDirection` says which way the axis runs on the screen,
 * for the case that all three lie on one spot.
 */
export function spreadAlignHandles(
  min: ScreenPoint,
  center: ScreenPoint,
  max: ScreenPoint,
  axisDirection: ScreenPoint,
  gap = MIN_ALIGN_HANDLE_GAP,
): [ScreenPoint, ScreenPoint, ScreenPoint] {
  const unit = (vector: ScreenPoint): ScreenPoint | null => {
    const length = Math.hypot(vector.x, vector.y);
    return length > 1e-6 ? { x: vector.x / length, y: vector.y / length } : null;
  };
  const along = unit({ x: max.x - min.x, y: max.y - min.y }) ?? unit(axisDirection) ?? { x: 1, y: 0 };
  const push = (point: ScreenPoint, fallback: ScreenPoint): ScreenPoint => {
    const offset = { x: point.x - center.x, y: point.y - center.y };
    const distance = Math.hypot(offset.x, offset.y);
    if (distance >= gap) return point;
    const direction = unit(offset) ?? fallback;
    return { x: center.x + direction.x * gap, y: center.y + direction.y * gap };
  };
  return [push(min, { x: -along.x, y: -along.y }), center, push(max, along)];
}
