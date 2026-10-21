import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { cadFacePickMesh } from "@/lib/cadFacePickMesh";

describe("the mesh Delete face picks on", () => {
  it("answers with the kernel's own triangle number on a body far past the bounds tree's threshold", () => {
    // 2000 small triangles in a row along x, listed in a shuffled order as a kernel might.
    const count = 2000;
    const positions = new Float32Array(count * 9);
    for (let triangle = 0; triangle < count; triangle += 1) positions.set([triangle, 0, 0, triangle + 0.9, 0, 0, triangle, 0.9, 0], triangle * 9);
    const order = Array.from({ length: count }, (_, triangle) => (triangle * 7919) % count);
    const indices = new Uint32Array(count * 3);
    order.forEach((triangle, slot) => indices.set([triangle * 3, triangle * 3 + 1, triangle * 3 + 2], slot * 3));
    const original = indices.slice();
    const mesh = cadFacePickMesh(positions, indices, 0);
    for (const triangle of [0, 777, 1500, 1999]) {
      const hit = new THREE.Raycaster(new THREE.Vector3(triangle + 0.2, 0.2, 5), new THREE.Vector3(0, 0, -1)).intersectObject(mesh)[0];
      expect(hit.faceIndex).toBe(order.indexOf(triangle));
    }
    // The index the editor keeps for the highlight is left as it was.
    expect([...indices]).toEqual([...original]);
  });
});
