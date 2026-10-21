import { describe, expect, it } from "vitest";
import { SKETCH_CAD_DEFLECTION } from "@/lib/cadModifierRuntime";
import { DENSE_SKETCH_ANGULAR_DEFLECTION, DENSE_SKETCH_CURVES, sketchCadDeflection } from "@/lib/sketchCadDeflection";
import type { SketchSegment } from "@/types/layerling";

const segments = (count: number, kind: SketchSegment["kind"], construction = false): SketchSegment[] =>
  Array.from({ length: count }, (_, index) => ({ id: `s${index}`, startId: `p${index}`, endId: `p${index + 1}`, kind, ...(construction ? { construction: true } : {}) }));

/**
 * #573: a traced drawing of about 900 curves came out of the kernel as 353,000 triangles, because every tiny curve was
 * cut into pieces of 9 degrees. Such a drawing is cut coarser in the angle; a sketch drawn by hand keeps its smooth curves.
 */
describe("how finely a sketch body is cut", () => {
  it("keeps the usual fineness for a sketch drawn by hand", () => {
    expect(sketchCadDeflection({ segments: segments(12, "bezier") })).toEqual(SKETCH_CAD_DEFLECTION);
    expect(sketchCadDeflection({ segments: segments(DENSE_SKETCH_CURVES, "bezier") })).toEqual(SKETCH_CAD_DEFLECTION);
  });

  it("cuts a drawing with very many curves coarser in the angle and keeps the 0.05 mm", () => {
    const fine = sketchCadDeflection({ segments: segments(DENSE_SKETCH_CURVES + 1, "bezier") });
    expect(fine.angular).toBe(DENSE_SKETCH_ANGULAR_DEFLECTION);
    expect(fine.angular).toBeGreaterThan(SKETCH_CAD_DEFLECTION.angular);
    expect(fine.linear).toBe(SKETCH_CAD_DEFLECTION.linear);
    expect(sketchCadDeflection({ segments: segments(900, "smooth") }).angular).toBe(DENSE_SKETCH_ANGULAR_DEFLECTION);
  });

  it("counts curves only: straight lines and construction lines do not make a drawing dense", () => {
    expect(sketchCadDeflection({ segments: segments(2000, "line") })).toEqual(SKETCH_CAD_DEFLECTION);
    expect(sketchCadDeflection({ segments: segments(2000, undefined) })).toEqual(SKETCH_CAD_DEFLECTION);
    expect(sketchCadDeflection({ segments: segments(2000, "bezier", true) })).toEqual(SKETCH_CAD_DEFLECTION);
    expect(sketchCadDeflection({ segments: [...segments(150, "bezier"), ...segments(5000, "line"), ...segments(150, "smooth")] }).angular).toBe(DENSE_SKETCH_ANGULAR_DEFLECTION);
  });
});
