import { describe, expect, it } from "vitest";
import { groupedShape, restoreGroupedChildren, restoreGroupedChildrenForEdges } from "@/lib/editorBooleans";
import type { WorkplaneShape } from "@/types/layerling";

function shape(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id: "shape",
    name: "Shape",
    kind: "box",
    color: "#ff5a47",
    x: 0,
    z: 0,
    elevation: 0,
    size: 20,
    width: 20,
    depth: 20,
    height: 20,
    rotation: 0,
    locked: false,
    hidden: false,
    ...overrides,
  };
}

// The group of two holes that is then grouped with a plate (#394).
function plateWithHoleGroup() {
  const holes = groupedShape([
    shape({ id: "hole-a", kind: "cylinder", x: -30, hole: true, height: 20 }),
    shape({ id: "hole-b", kind: "cylinder", x: 30, hole: true, height: 20 }),
  ]);
  if (!holes) throw new Error("the holes did not group");
  const plate = shape({ id: "plate", width: 100, depth: 40, size: 100, height: 6 });
  const group = groupedShape([plate, holes]);
  if (!group) throw new Error("the plate did not group");
  return group;
}

describe("the bodies of a group for the edge tool", () => {
  it("opens a group of nothing but holes into its holes", () => {
    const group = plateWithHoleGroup();
    expect(restoreGroupedChildren(group)).toHaveLength(2);
    const parts = restoreGroupedChildrenForEdges(group);
    expect(parts).toHaveLength(3);
    expect(parts.filter((part) => part.hole)).toHaveLength(2);
    expect(parts.filter((part) => !part.hole)).toHaveLength(1);
    expect(parts.every((part) => part.kind !== "mesh")).toBe(true);
  });

  it("keeps the holes where they stood", () => {
    const parts = restoreGroupedChildrenForEdges(plateWithHoleGroup());
    const holeCenters = parts.filter((part) => part.hole).map((part) => part.x).sort((a, b) => a - b);
    expect(holeCenters[0]).toBeCloseTo(-30, 6);
    expect(holeCenters[1]).toBeCloseTo(30, 6);
  });

  it("keeps a group that mixes solids and holes closed, since it cuts only its own solids", () => {
    const inner = groupedShape([
      shape({ id: "block", width: 20, depth: 20, size: 20 }),
      shape({ id: "bore", kind: "cylinder", hole: true, width: 8, depth: 8, size: 8, height: 30 }),
    ]);
    if (!inner) throw new Error("the inner group did not group");
    const outer = groupedShape([shape({ id: "plate", x: 40, width: 40, size: 40 }), inner]);
    if (!outer) throw new Error("the outer group did not group");
    const parts = restoreGroupedChildrenForEdges(outer);
    expect(parts).toHaveLength(2);
    expect(parts.some((part) => (part.groupedShapes?.length ?? 0) > 0)).toBe(true);
  });

  it("leaves a plain group as it is", () => {
    const group = groupedShape([shape({ id: "a" }), shape({ id: "b", x: 40 })]);
    if (!group) throw new Error("did not group");
    expect(restoreGroupedChildrenForEdges(group).map((part) => part.id.split("-ungroup-")[0])).toEqual(["a", "b"]);
  });
});
