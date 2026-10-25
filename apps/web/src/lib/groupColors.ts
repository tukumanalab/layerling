import type { WorkplaneShape } from "@/types/layerling";

/**
 * Whether a group shows each part in its own colour ("Multicolor" in
 * similar tools) instead of one colour for the whole group.
 *
 * A bundle always keeps its parts' colours. Without an explicit choice a
 * group keeps what it always did: parts that stay separate bodies show their
 * own colour, a group that was cut into one mesh shows the group colour.
 */
export function groupShowsPartColors(shape: WorkplaneShape): boolean {
  if (!shape.groupedShapes?.length) return false;
  if (shape.groupOperation === "bundle") return true;
  // A hull is one body round its parts: there is no part of it to show in its own colour (#863).
  if (shape.groupOperation === "hull") return false;
  return shape.multicolor ?? !shape.importedMesh;
}

/** Whether the "Multicolor" switch applies to this shape at all. */
export function canToggleGroupColors(shape: WorkplaneShape): boolean {
  return Boolean(shape.groupedShapes?.length) && shape.groupOperation !== "bundle" && shape.groupOperation !== "hull" && !shape.hole;
}
