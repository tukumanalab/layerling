import { SKETCH_CAD_DEFLECTION } from "@/lib/cadModifierRuntime";
import type { CadModifierDeflection } from "@/lib/cadModifierTypes";
import type { SketchProfile } from "@/types/layerling";

/**
 * A sketch with this many curves is a drawing, traced or imported (an SVG), not an outline drawn by hand.
 * #573: a traced drawing of about 900 curves, 60 mm wide, came out of the kernel as 353,000 triangles, and a few copies
 * of it could not be joined (the limit is 250,000). Its small curves were cut into pieces of 9 degrees each, where the
 * 0.05 mm of the linear deflection was long met.
 */
export const DENSE_SKETCH_CURVES = 200;
/** The angle for such a drawing: the linear deflection of 0.05 mm still holds, only the extra pieces on tiny curves go (35,000 triangles). */
export const DENSE_SKETCH_ANGULAR_DEFLECTION = 0.5;

/** How finely the kernel cuts the surfaces of this sketch's body: the usual, or coarser in the angle for a drawing with very many curves. */
export function sketchCadDeflection(profile: Pick<SketchProfile, "segments">): CadModifierDeflection {
  const curves = profile.segments.filter((segment) => !segment.construction && segment.kind !== undefined && segment.kind !== "line").length;
  return curves > DENSE_SKETCH_CURVES ? { linear: SKETCH_CAD_DEFLECTION.linear, angular: DENSE_SKETCH_ANGULAR_DEFLECTION } : SKETCH_CAD_DEFLECTION;
}
