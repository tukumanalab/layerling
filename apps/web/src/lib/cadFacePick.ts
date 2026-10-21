/**
 * Picking whole CAD faces for the Delete face tool (#451): every triangle of
 * the prepared body's tessellation knows the face it came from, so a click on
 * a triangle picks the face, and a curved face lights up as one piece.
 */

/** What the viewport needs to pick faces: the prepared body's tessellation in the scene, the face of each triangle, and the faces picked so far. */
export type CadFacePick = {
  shapeId: string;
  positions: Float32Array;
  indices: Uint32Array;
  triangleFaces: Int32Array;
  selectedFaceIds: number[];
};

/**
 * The face id (its place in the body's face list) of every triangle. The
 * kernel's face groups are [start, count, faceHash] triples, start and count
 * in index entries (three per triangle), not in the face list's order; a face
 * is found by its hash. Faces that share a hash are taken in list order, the
 * group's own place first. A triangle of no known face gets -1.
 */
export function cadTriangleFaces(groups: ArrayLike<number>, faceHashes: number[], triangleCount: number) {
  const triangleFaces = new Int32Array(triangleCount).fill(-1);
  const taken = new Set<number>();
  for (let group = 0; group * 3 < groups.length; group += 1) {
    const start = groups[group * 3];
    const count = groups[group * 3 + 1];
    const hash = groups[group * 3 + 2];
    const face = faceHashes[group] === hash && !taken.has(group)
      ? group
      : faceHashes.findIndex((other, id) => other === hash && !taken.has(id));
    if (face < 0) continue;
    taken.add(face);
    const first = Math.floor(start / 3);
    const end = Math.min(triangleCount, first + Math.floor(count / 3));
    triangleFaces.fill(face, first, end);
  }
  return triangleFaces;
}

/** The corners of every triangle of the given faces, three per triangle, for an unindexed highlight mesh. */
export function cadFaceHighlightPositions(positions: ArrayLike<number>, indices: ArrayLike<number>, triangleFaces: ArrayLike<number>, faceIds: number[]) {
  const wanted = new Set(faceIds);
  const triangles: number[] = [];
  for (let triangle = 0; triangle < triangleFaces.length; triangle += 1) {
    if (wanted.has(triangleFaces[triangle])) triangles.push(triangle);
  }
  const corners = new Float32Array(triangles.length * 9);
  triangles.forEach((triangle, slot) => {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = indices[triangle * 3 + corner];
      corners.set([positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]], slot * 9 + corner * 3);
    }
  });
  return corners;
}
