import { describe, expect, it } from "vitest";
import { meshForShape } from "@/lib/editorMeshCore";
import { deformsAboutOrigin } from "@/lib/workplaneShapes";
import type { WorkplaneShape } from "@/types/layerling";

function shape(kind: string, extra: Record<string, unknown> = {}): WorkplaneShape {
  return { id: "s", name: "s", kind, color: "#d41721", x: 0, z: 0, elevation: 0, size: 60, width: 60, depth: 60, height: 120, rotation: 0, ...extra } as unknown as WorkplaneShape;
}

/** How far the corners of the body reach from the axis through its origin, for the rings of vertices at each height. */
function reachByHeight(mesh: ReturnType<typeof meshForShape>) {
  const reach = new Map<number, number>();
  for (const [x, y, z] of mesh.vertices) {
    const key = Math.round(y * 10) / 10;
    reach.set(key, Math.max(reach.get(key) ?? 0, Math.hypot(x, z)));
  }
  return [...reach.values()];
}

describe("a star twists about its own middle (#476)", () => {
  it("knows which shapes are drawn round their middle", () => {
    expect(deformsAboutOrigin("star")).toBe(true);
    expect(deformsAboutOrigin("heart")).toBe(false);
    expect(deformsAboutOrigin("box")).toBe(false);
  });

  it("keeps the tips of a five-pointed star within the star's own radius at every height", () => {
    const plain = Math.max(...reachByHeight(meshForShape(shape("star"))));
    const twisted = Math.max(...reachByHeight(meshForShape(shape("star", { extrudeTwist: 360 }))));
    // About the middle of its box the tips came up to 35 mm from the axis, the star being 30 mm in radius.
    expect(twisted).toBeLessThan(plain + 0.05);
  });

  it("leaves an untwisted star as it was", () => {
    const plain = meshForShape(shape("star"));
    const reaches = reachByHeight(plain);
    expect(Math.max(...reaches)).toBeGreaterThan(29);
  });
});
