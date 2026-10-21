import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";

/**
 * The mesh Delete face (#451) picks faces on: the prepared body's
 * tessellation, kept out of the scene. A hit's faceIndex has to stay the
 * kernel's own triangle number, because that is what the face of each
 * triangle is stored by - so the bounds tree is built "indirect", which
 * leaves the triangle order alone (a plain one sorts the index in place).
 */
export function cadFacePickMesh(positions: Float32Array, indices: Uint32Array, layer: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
  computeBoundsTree.call(geometry, { targetLeafSize: 12, indirect: true });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.raycast = acceleratedRaycast;
  mesh.layers.set(layer);
  return mesh;
}

export function disposeCadFacePickMesh(mesh: THREE.Mesh) {
  disposeBoundsTree.call(mesh.geometry);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
}
