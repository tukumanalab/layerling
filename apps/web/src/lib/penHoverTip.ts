/**
 * Where the small text for a hovered control goes (the Apple Pencil can hover over an iPad, but a
 * browser shows no title text for it). The centre sits under the control, kept far enough from the
 * sides that the text stays on the screen; near the bottom it goes above the control instead.
 */
export const PEN_TIP_HALF_WIDTH = 130;
const PEN_TIP_GAP = 8;
const PEN_TIP_HEIGHT = 44;

export type PenTipRect = { left: number; right: number; top: number; bottom: number };

export function penTipPosition(rect: PenTipRect, viewport: { width: number; height: number }) {
  const centre = (rect.left + rect.right) / 2;
  const left = Math.min(Math.max(centre, PEN_TIP_HALF_WIDTH + 8), Math.max(viewport.width - PEN_TIP_HALF_WIDTH - 8, PEN_TIP_HALF_WIDTH + 8));
  const below = rect.bottom + PEN_TIP_GAP;
  const fitsBelow = below + PEN_TIP_HEIGHT <= viewport.height;
  return { left, top: fitsBelow ? below : Math.max(rect.top - PEN_TIP_GAP - PEN_TIP_HEIGHT, 8), above: !fitsBelow };
}
