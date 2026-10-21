import type { CadModifierDeflection } from "@/lib/cadModifierTypes";
import type { SketchInset, SketchProfile, SketchStroke } from "@/types/layerling";

export type SketchCadBuildRequest = {
  type: "build";
  requestId: number;
  profile: SketchProfile;
  height: number;
  /** Set for a revolve: the sketch is turned about the vertical axis instead of pulled up by `height`. */
  revolve?: { startAngle: number; sweepAngle: number };
  /** Set for a sweep (#400): the outlines are the cross-section, the construction line is the path they are pulled along. */
  sweep?: true;
  /** Set for a stroked or widened sketch: the kernel moves the outlines itself (cadSketchStroke.ts). */
  stroke?: SketchStroke;
  /** Set for a sketch built set in from its outlines (the face tool): the kernel moves them itself (cadSketchInset.ts). */
  inset?: SketchInset;
};

/** The message of the error the worker answers with when a stroke is for the polygon route to build. */
export const SKETCH_STROKE_UNSUPPORTED = "stroke-unsupported";

/** The message of the error the worker answers with when an inset is for the polygon route to build. */
export const SKETCH_INSET_UNSUPPORTED = "inset-unsupported";

export type SketchCadBuildResponse =
  | {
      type: "built";
      requestId: number;
      positions: Float32Array;
      normals: Float32Array;
      indices: Uint32Array;
      triangleCount: number;
      brep: string;
      /** How finely the body was cut, kept with it so that an edge treatment later does not cut it coarser (#573). */
      deflection: CadModifierDeflection;
    }
  | { type: "error"; requestId: number; message: string };
