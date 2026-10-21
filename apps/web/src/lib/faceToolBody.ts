import { getManifoldRuntime } from "@/lib/editorMeshCore";
import { cadShapeFromSketchProfile } from "@/lib/editorSketchCad";
import type { FaceToolSettings } from "@/lib/faceTool";
import { faceToolPlan } from "@/lib/faceToolFrame";
import type { PerforableFace } from "@/lib/holePatternShapes";
import { placeSketchShape } from "@/lib/sketchPlacement";
import { canonicalizeShape, withHoleMode } from "@/lib/workplaneShapes";
import type { WorkplaneShape } from "@/types/layerling";

/**
 * The body the face tool adds, built by the CAD worker from faceToolPlan: standing on the face
 * (out) or reaching into it as a hole (in). Null when the inset and the radius leave nothing.
 */
export async function faceToolBody(
  source: WorkplaneShape,
  face: PerforableFace,
  settings: FaceToolSettings,
  look: { name: string; color: string; id?: string },
): Promise<WorkplaneShape | null> {
  const plan = faceToolPlan(await getManifoldRuntime(), source, face, settings);
  if (!plan) return null;
  const built = await cadShapeFromSketchProfile(plan.profile, plan.height);
  const placed = placeSketchShape({ ...built, name: look.name, color: look.color, ...(look.id ? { id: look.id } : {}) }, plan.workplane);
  return canonicalizeShape(withHoleMode(placed, settings.direction === "in"));
}
