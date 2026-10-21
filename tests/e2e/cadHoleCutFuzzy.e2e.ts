import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "three";
import { OcctKernel, type ShapeHandle } from "occt-wasm";
import { fuzzyCut } from "@/lib/cadFuzzyCut";
import { quaternionForShape } from "@/lib/editorBooleans";

/**
 * A pocket whose depth is a whole value (DrJones' "Taschenfase"): a wedge of 50 x 30 x 20 mm and a cylinder of 20 mm as a hole,
 * turned to stand on the slope, 5 mm high. At exactly 5 mm the hole's end meets the wedge's faces and edges exactly,
 * and the plain cut left a skin as thin as a rounding error: two faces and three edges more than at 5.001 or 4.99
 * mm, among them two edges on one line, which no chamfer could be made on ("cannot be chamfered together").
 */
describe("the cut of a hole that meets a face of the body exactly", () => {
  let cad: OcctKernel;
  beforeAll(async () => {
    const wasm = join(dirname(fileURLToPath(import.meta.resolve("occt-wasm"))), "occt-wasm.wasm");
    cad = await OcctKernel.init({ wasm });
  });

  const wedge = () => {
    const corners = [[-35, 0], [15, 0], [15, 20]].map(([x, y]) => ({ x, y, z: -15 }));
    const face = cad.makeFace(cad.makeWire(corners.map((a, i) => cad.makeLineEdge(a, corners[(i + 1) % corners.length]))));
    return cad.extrude(face, 0, 0, 30);
  };

  /** The pocket as the editor builds it from the shape's position and turns (y up, kernel z up turned first). */
  const pocket = (height: number) => {
    const rotation = quaternionForShape({ rotation: 291.8, rotationX: 90, rotationZ: 90 });
    const centre = new THREE.Vector3(-6.684825055622067, 6.133487163988584 + height / 2, 0);
    const e = new THREE.Matrix4().compose(centre, rotation, new THREE.Vector3(1, 1, 1)).elements;
    const standing = cad.transform(cad.makeCylinder(10, height), [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0]);
    const box = cad.getBoundingBox(standing);
    const centred = cad.translate(standing, 0, -(box.ymin + box.ymax) / 2, 0);
    return cad.transform(centred, [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]]);
  };

  const shapeOf = (solid: ShapeHandle) => {
    const tidy = cad.unifySameDomain(cad.simplify(solid));
    return { valid: cad.isValid(tidy), faces: cad.getSubShapes(tidy, "face").length, edges: cad.getSubShapes(tidy, "edge").length, volume: cad.getVolume(tidy) };
  };

  it("leaves the same faces and edges as a pocket a thousandth deeper", () => {
    const deeper = shapeOf(cad.cut(wedge(), pocket(5.001)));
    for (const height of [5, 4.999999999999991]) {
      const cut = shapeOf(fuzzyCut(cad, wedge(), pocket(height)));
      expect(cut.valid).toBe(true);
      expect(cut.faces).toBe(deeper.faces);
      expect(cut.edges).toBe(deeper.edges);
      expect(Math.abs(cut.volume - deeper.volume)).toBeLessThan(0.5);
    }
  });

  it("shows that the plain cut leaves a skin there, which is why the fuzzy cut exists", () => {
    const plain = shapeOf(cad.cut(wedge(), pocket(5)));
    const deeper = shapeOf(cad.cut(wedge(), pocket(5.001)));
    expect(plain.edges).toBeGreaterThan(deeper.edges);
  });

  it("cuts a pocket that does not meet anything as the plain cut does", () => {
    for (const height of [4.99, 4.9]) {
      const plain = shapeOf(cad.cut(wedge(), pocket(height)));
      const fuzzy = shapeOf(fuzzyCut(cad, wedge(), pocket(height)));
      expect(fuzzy.faces).toBe(plain.faces);
      expect(fuzzy.edges).toBe(plain.edges);
      expect(Math.abs(fuzzy.volume - plain.volume)).toBeLessThan(1e-6);
    }
  });

  it("cuts a through hole in a box with the volume of the hole", () => {
    const box = cad.translate(cad.makeBox(40, 40, 20), -20, -20, 0);
    const hole = cad.translate(cad.makeCylinder(5, 40), 0, 0, -10);
    const cut = shapeOf(fuzzyCut(cad, box, hole));
    expect(cut.valid).toBe(true);
    expect(Math.abs(cut.volume - (40 * 40 * 20 - Math.PI * 25 * 20))).toBeLessThan(1e-3);
  });
});
