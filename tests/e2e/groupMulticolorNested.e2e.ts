import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// The exact kernel (Manifold) loads its files relative to the page; in node they are the public folder.
(globalThis as unknown as { window: unknown }).window = { location: { href: pathToFileURL(resolve("apps/web/public") + "/").href } };
import { buildGroupedShapeFromSelection, multicolorExportSolids } from "@/lib/editorBooleans";
import type { WorkplaneShape } from "@/types/layerling";

function box(id: string, color: string, x: number, overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id, name: id, kind: "box", color, x, z: 0, elevation: 0, size: 20, width: 20, depth: 20, height: 10, rotation: 0,
    ...overrides,
  } as unknown as WorkplaneShape;
}

describe("a group of two colours brought into another group keeps its colours (#418)", () => {
  it("shows both colours after it is grouped with a hole", async () => {
    // The red and white parts first, as one group of two colours.
    const first = await buildGroupedShapeFromSelection([box("red", "#d41721", -10), box("white", "#ffffff", 10)], 250_000);
    expect(first.group).not.toBeNull();
    const twoColours = { ...first.group!, multicolor: true } as WorkplaneShape;
    // Then the hole through the middle of it, as a second step.
    const hole = box("hole", "#999999", 0, { hole: true, width: 6, depth: 6, height: 30 });
    const second = await buildGroupedShapeFromSelection([twoColours, hole], 250_000);
    expect(second.group).not.toBeNull();
    const children = second.group!.groupedShapes ?? [];
    // The outer group carries the red and the white part itself, not the inner group as one body.
    expect(children.map((child) => child.color).sort()).toContain("#d41721");
    expect(children.map((child) => child.color)).toContain("#ffffff");
    const solids = multicolorExportSolids({ ...second.group!, multicolor: true } as WorkplaneShape);
    expect(solids?.map((solid) => solid.color).sort()).toEqual(["#d41721", "#ffffff"]);
    solids?.forEach((solid) => solid.probe.geometry.dispose());
  });

  it("leaves a group of one colour as it was", async () => {
    const first = await buildGroupedShapeFromSelection([box("a", "#d41721", -10), box("b", "#d41721", 10)], 250_000);
    const hole = box("hole", "#999999", 0, { hole: true, width: 6, depth: 6, height: 30 });
    const second = await buildGroupedShapeFromSelection([{ ...first.group!, multicolor: true } as WorkplaneShape, hole], 250_000);
    expect(second.group!.groupedShapes?.some((child) => Boolean(child.groupedShapes?.length))).toBe(true);
  });
});
