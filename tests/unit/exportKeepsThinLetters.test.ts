import { describe, expect, it } from "vitest";
import type { MeshData } from "@/lib/editorMeshCore";
import type { WorkplaneShape } from "@/types/layerling";
import { colorSeparatedExportMeshes, unionOverlappingExportMeshes } from "@/lib/editorBooleans";

type Vec = [number, number, number];

function boxParts(min: Vec, max: Vec) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const vertices: Vec[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]];
  const faces: [number, number, number][] = [];
  for (const [a, b, c, d] of quads) faces.push([a, b, c], [a, c, d]);
  return { vertices, faces };
}

/** One body of two loose closed pieces: a letter-sized block and a much smaller one, such as the dot of an i. */
function twoPieces(): MeshData {
  const big = boxParts([0, 0, 0], [3, 3, 3]);
  const small = boxParts([10, 0, 0], [10.4, 0.4, 0.4]);
  const vertices = [...big.vertices, ...small.vertices];
  const faces = [...big.faces, ...small.faces.map(([a, b, c]) => [a + big.vertices.length, b + big.vertices.length, c + big.vertices.length] as [number, number, number])];
  return { name: "letters", vertices, faces } as unknown as MeshData;
}

function shape(): WorkplaneShape {
  return { id: "text", name: "Text", kind: "box", color: "#cf101b", x: 0, z: 0, elevation: 0, size: 3, width: 3, depth: 3, height: 3, rotation: 0, locked: false, hidden: false } as WorkplaneShape;
}

describe("the export and small loose pieces of one body (#585)", () => {
  it("keeps the thin small pieces of a body that was not cut or merged, such as the dot of an i in a small text", async () => {
    const mesh = twoPieces();
    const stl = await unionOverlappingExportMeshes([shape()], [mesh], [false]);
    expect(stl.meshes[0].faces.length).toBe(24);
    expect(stl.splinters).toBe(0);
    const threeMf = await colorSeparatedExportMeshes([shape()], [mesh], [false]);
    expect(threeMf.meshes[0].faces.length).toBe(24);
    expect(threeMf.splinters).toBe(0);
  });

  it("still leaves the splinter out of a body that a cut made", async () => {
    const mesh = twoPieces();
    const cut = await unionOverlappingExportMeshes([shape()], [mesh], [true]);
    expect(cut.meshes[0].faces.length).toBe(12);
    expect(cut.splinters).toBe(1);
  });
});
