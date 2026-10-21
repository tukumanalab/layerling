import { describe, expect, it } from "vitest";
import { cadFaceHighlightPositions, cadTriangleFaces } from "@/lib/cadFacePick";

describe("which CAD face a triangle of the tessellation belongs to", () => {
  it("reads the kernel's face groups, counted in index entries, by the faces' hashes", () => {
    // Two faces of two triangles each and one of one triangle; the kernel lists the groups in another order.
    const groups = [0, 6, 300, 6, 3, 100, 9, 6, 200];
    expect([...cadTriangleFaces(groups, [100, 200, 300], 5)]).toEqual([2, 2, 0, 1, 1]);
  });

  it("keeps faces apart that share a hash, and marks triangles of an unknown face", () => {
    const groups = [0, 3, 7, 3, 3, 7, 6, 3, 9];
    expect([...cadTriangleFaces(groups, [7, 7], 4)]).toEqual([0, 1, -1, -1]);
  });
});

describe("the highlight of picked CAD faces", () => {
  // A unit square in the XY plane as two triangles, face 0 and face 1.
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const triangleFaces = new Int32Array([0, 1]);

  it("copies the corners of the picked faces' triangles, three per triangle", () => {
    expect([...cadFaceHighlightPositions(positions, indices, triangleFaces, [1])]).toEqual([0, 0, 0, 1, 1, 0, 0, 1, 0]);
    expect(cadFaceHighlightPositions(positions, indices, triangleFaces, [0, 1])).toHaveLength(18);
  });

  it("is empty when nothing is picked", () => {
    expect(cadFaceHighlightPositions(positions, indices, triangleFaces, [])).toHaveLength(0);
  });
});
