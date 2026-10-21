import { beforeAll, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OcctKernel, type ShapeHandle } from "occt-wasm";
import { cadFaceList, cadFaceTessellation, DELETE_FACES_UNCHANGED_MESSAGE, deleteFacesSolid } from "@/lib/cadDeleteFaces";

/*
 * Deleting faces of an exact body (#451): the faces around them grow to close
 * the gap, and the body stays one valid solid with the volume it had before
 * the feature was added. Where the gap cannot be closed the kernel hands the
 * body back unchanged without a word, which has to become a plain refusal.
 */

let cad: OcctKernel;

beforeAll(async () => {
  const wasm = join(dirname(fileURLToPath(import.meta.resolve("occt-wasm"))), "occt-wasm.wasm");
  cad = await OcctKernel.init({ wasm });
});

const box = () => cad.makeBox(40, 30, 20);
const facesWhere = (shape: ShapeHandle, test: (box: { xmin: number; xmax: number; ymin: number; ymax: number; zmin: number; zmax: number }, face: ShapeHandle) => boolean) =>
  cad.getSubShapes(shape, "face").filter((face) => test(cad.getBoundingBox(face), face));

describe("deleting faces of an exact body", () => {
  it("takes the fillets off the top edges of a box", () => {
    const b = box();
    const filleted = cad.fillet(b, cad.getSubShapes(b, "edge").filter((edge) => cad.getBoundingBox(edge).zmin > 19.99), 3);
    expect(cad.getVolume(filleted)).toBeCloseTo(23740, 0);
    const fillets = facesWhere(filleted, (_, face) => cad.surfaceType(face) !== "plane");
    expect(fillets).toHaveLength(4);
    const result = deleteFacesSolid(cad, filleted, fillets);
    expect(cad.isValid(result)).toBe(true);
    expect(cad.getVolume(result)).toBeCloseTo(24000, 3);
    expect(cad.getSubShapes(result, "face")).toHaveLength(6);
  });

  it("fills a hole, takes a boss off and a lower box joined at the side", () => {
    const hole = cad.cut(box(), cad.translate(cad.makeCylinder(5, 40), 20, 15, -10));
    expect(cad.getVolume(deleteFacesSolid(cad, hole, facesWhere(hole, (_, face) => cad.surfaceType(face) === "cylinder")))).toBeCloseTo(24000, 3);

    const boss = cad.fuse(box(), cad.translate(cad.makeCylinder(6, 10), 20, 15, 20));
    const bossFaces = facesWhere(boss, (bb, face) => (bb.zmin > 19.99 && cad.surfaceType(face) !== "plane") || bb.zmin > 29.99);
    expect(bossFaces).toHaveLength(2);
    expect(cad.getVolume(deleteFacesSolid(cad, boss, bossFaces))).toBeCloseTo(24000, 3);

    const stepped = cad.fuse(box(), cad.translate(cad.makeBox(20, 30, 8), 40, 0, 0));
    // The lower box's own five faces, not the main box's wall above it at x = 40.
    const lower = facesWhere(stepped, (bb) => bb.xmin > 39.99 && bb.xmax > 40.01);
    expect(lower).toHaveLength(5);
    expect(cad.getVolume(deleteFacesSolid(cad, stepped, lower))).toBeCloseTo(24000, 3);
  });

  it("refuses with a plain sentence where the gap cannot be closed, or a face too many is picked", () => {
    const b = box();
    expect(() => deleteFacesSolid(cad, b, facesWhere(b, (bb) => bb.xmax < 0.01))).toThrow(DELETE_FACES_UNCHANGED_MESSAGE);
    const stepped = cad.fuse(box(), cad.translate(cad.makeBox(20, 30, 8), 40, 0, 0));
    // The lower box plus the main box's wall above it: the kernel changes nothing.
    expect(() => deleteFacesSolid(cad, stepped, facesWhere(stepped, (bb) => bb.xmin > 39.99))).toThrow(DELETE_FACES_UNCHANGED_MESSAGE);

  });

  it("refuses when the kernel removes only part of what was picked", () => {
    // A hole and a plain side: the kernel fills the hole and builds the side again where it was.
    const hole = cad.cut(box(), cad.translate(cad.makeCylinder(5, 40), 20, 15, -10));
    const holeAndSide = facesWhere(hole, (bb, face) => cad.surfaceType(face) === "cylinder" || bb.xmax < 0.01);
    expect(holeAndSide).toHaveLength(2);
    expect(() => deleteFacesSolid(cad, hole, holeAndSide)).toThrow(DELETE_FACES_UNCHANGED_MESSAGE);
    // A hole and one face too many for the lower box: the kernel fills the hole and keeps the box.
    const stepped = cad.cut(cad.fuse(box(), cad.translate(cad.makeBox(20, 30, 8), 40, 0, 0)), cad.translate(cad.makeCylinder(5, 40), 20, 15, -10));
    const steppedSolid = cad.isSolid(stepped) ? stepped : cad.getSubShapes(stepped, "solid")[0];
    const holeAndTooMany = facesWhere(steppedSolid, (bb, face) => cad.surfaceType(face) === "cylinder" || bb.xmin > 39.99);
    expect(() => deleteFacesSolid(cad, steppedSolid, holeAndTooMany)).toThrow(DELETE_FACES_UNCHANGED_MESSAGE);
  });

  it("refuses a result the kernel's own check calls invalid", () => {
    const hole = cad.cut(box(), cad.translate(cad.makeCylinder(5, 40), 20, 15, -10));
    const wall = facesWhere(hole, (_, face) => cad.surfaceType(face) === "cylinder");
    // A real imported part (a planter from Fusion 360) makes defeature return invalid solids for two of its faces;
    // without that file the check is held to it this way.
    const isValid = vi.spyOn(cad, "isValid").mockReturnValue(false);
    try {
      expect(() => deleteFacesSolid(cad, hole, wall)).toThrow(DELETE_FACES_UNCHANGED_MESSAGE);
    } finally {
      isValid.mockRestore();
    }
    expect(cad.getVolume(deleteFacesSolid(cad, hole, wall))).toBeCloseTo(24000, 3);
  });

  it("fills the bore of a spool whose hub has the same kind, area and middle", () => {
    // Bore r2 over 10 mm and hub r4 over 5 mm: both cylinders of 40π mm² around the same middle.
    const flange = (z: number) => cad.translate(cad.makeCylinder(8, 2.5), 0, 0, z);
    const spool = cad.fuse(cad.fuse(flange(-5), flange(2.5)), cad.translate(cad.makeCylinder(4, 5), 0, 0, -2.5));
    const bored = cad.cut(spool, cad.translate(cad.makeCylinder(2, 20), 0, 0, -10));
    const body = cad.isSolid(bored) ? bored : cad.getSubShapes(bored, "solid")[0];
    const bore = facesWhere(body, (bb, face) => cad.surfaceType(face) === "cylinder" && bb.xmax < 2.01);
    expect(bore).toHaveLength(1);
    expect(cad.getVolume(deleteFacesSolid(cad, body, bore))).toBeCloseTo(Math.PI * (64 * 5 + 16 * 5), 3);
  });

  it("turns a pocket into a hole straight through when only its floor is deleted", () => {
    const pocket = cad.cut(box(), cad.translate(cad.makeBox(10, 10, 12), 15, 10, 8));
    expect(cad.getVolume(pocket)).toBeCloseTo(22800, 3);
    const floor = facesWhere(pocket, (bb) => Math.abs(bb.zmin - 8) < 1e-6 && Math.abs(bb.zmax - 8) < 1e-6);
    expect(floor).toHaveLength(1);
    expect(cad.getVolume(deleteFacesSolid(cad, pocket, floor))).toBeCloseTo(22000, 3);
  });

  it("leaves a body the edge tool can still fillet", () => {
    const hole = cad.cut(box(), cad.translate(cad.makeCylinder(5, 40), 20, 15, -10));
    const result = deleteFacesSolid(cad, hole, facesWhere(hole, (_, face) => cad.surfaceType(face) === "cylinder"));
    const rounded = cad.fillet(result, cad.getSubShapes(result, "edge").filter((edge) => cad.getBoundingBox(edge).zmin > 19.99), 2);
    expect(cad.isValid(rounded)).toBe(true);
    expect(cad.getVolume(rounded)).toBeLessThan(24000);
  });

  it("exports to STEP with its true faces", () => {
    const hole = cad.cut(box(), cad.translate(cad.makeCylinder(5, 40), 20, 15, -10));
    const result = deleteFacesSolid(cad, hole, facesWhere(hole, (_, face) => cad.surfaceType(face) === "cylinder"));
    const back = cad.importStep(cad.exportStep(result));
    expect(cad.getVolume(back)).toBeCloseTo(24000, 3);
    expect(cad.getSubShapes(back, "face").map((face) => cad.surfaceType(face))).toEqual(Array(6).fill("plane"));
  });

  it("lists the faces with their kind, area and middle, planes with their normal", () => {
    const hole = cad.cut(box(), cad.translate(cad.makeCylinder(5, 40), 20, 15, -10));
    const faces = cadFaceList(cad, hole);
    expect(faces).toHaveLength(7);
    const cylinder = faces.find((face) => face.kind === "cylinder")!;
    expect(cylinder.area).toBeCloseTo(Math.PI * 10 * 20, 0);
    expect(cylinder.normal).toBeUndefined();
    const top = faces.find((face) => face.kind === "plane" && face.center.z > 19.99)!;
    expect(top.normal).toEqual({ x: 0, y: 0, z: 1 });
    expect(top.area).toBeCloseTo(1200 - Math.PI * 25, 3);
    expect(faces.map((face) => face.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("knows the face of every triangle it draws, a curved face as one piece", () => {
    const b = box();
    const filleted = cad.fillet(b, cad.getSubShapes(b, "edge").filter((edge) => cad.getBoundingBox(edge).zmin > 19.99), 3);
    const kinds = cadFaceList(cad, filleted).map((face) => face.kind);
    const { indices, triangleFaces } = cadFaceTessellation(cad, filleted, { linearDeflection: 0.1, angularDeflection: 0.3 });
    expect(triangleFaces).toHaveLength(indices.length / 3);
    expect([...triangleFaces].every((face) => face >= 0)).toBe(true);
    expect(new Set(triangleFaces).size).toBe(kinds.length);
    // The top is one flat face of two triangles; each fillet is many triangles of one face.
    const perFace = kinds.map((_, id) => [...triangleFaces].filter((face) => face === id).length);
    kinds.forEach((kind, id) => {
      if (kind !== "plane") expect(perFace[id]).toBeGreaterThan(10);
    });
  });

  it("names for every triangle the face it lies on", () => {
    const b = box();
    const filleted = cad.fillet(b, cad.getSubShapes(b, "edge").filter((edge) => cad.getBoundingBox(edge).zmin > 19.99), 3);
    const faces = cad.getSubShapes(filleted, "face");
    const bounds = faces.map((face) => cad.getBoundingBox(face));
    const { positions, indices, triangleFaces } = cadFaceTessellation(cad, filleted, { linearDeflection: 0.1, angularDeflection: 0.3 });
    // The middle of each triangle lies inside the box of its own face, and the faces of this body are told apart by their boxes.
    for (let triangle = 0; triangle < triangleFaces.length; triangle += 1) {
      const middle = [0, 1, 2].map((axis) => [0, 1, 2].reduce((sum, corner) => sum + positions[indices[triangle * 3 + corner] * 3 + axis], 0) / 3);
      const own = bounds[triangleFaces[triangle]];
      expect(middle[0] >= own.xmin - 1e-3 && middle[0] <= own.xmax + 1e-3 && middle[1] >= own.ymin - 1e-3 && middle[1] <= own.ymax + 1e-3 && middle[2] >= own.zmin - 1e-3 && middle[2] <= own.zmax + 1e-3).toBe(true);
    }
  });
});
