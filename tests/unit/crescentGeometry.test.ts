import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import {
  createCrescentGeometry,
  normalizeCrescentQuality,
  normalizeCrescentThickness,
  normalizeCrescentTipFillet,
  crescentSettings,
} from "@/lib/crescentGeometry";

function edgeUseCounts(position: { count: number; getX: (index: number) => number; getY: (index: number) => number; getZ: (index: number) => number }) {
  const uses = new Map<string, number>();
  const keyForPoint = (index: number) => [position.getX(index), position.getY(index), position.getZ(index)]
    .map((value) => value.toFixed(5))
    .join(",");
  for (let index = 0; index + 2 < position.count; index += 3) {
    const triangle = [keyForPoint(index), keyForPoint(index + 1), keyForPoint(index + 2)];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  return uses;
}

// Every edge must be walked once in each direction (a closed mesh with outward faces). A lid turned
// the wrong way against the walls still passes the undirected count above, but a boolean union
// with such a mesh failed and a slicer showed the overlap as hollow (#493).
function directedEdgesPaired(position: { count: number; getX: (index: number) => number; getY: (index: number) => number; getZ: (index: number) => number }) {
  const keyForPoint = (index: number) => [position.getX(index), position.getY(index), position.getZ(index)]
    .map((value) => value.toFixed(5))
    .join(",");
  const walked = new Map<string, number>();
  for (let index = 0; index + 2 < position.count; index += 3) {
    const triangle = [keyForPoint(index), keyForPoint(index + 1), keyForPoint(index + 2)];
    for (let edge = 0; edge < 3; edge += 1) {
      const key = `${triangle[edge]}>${triangle[(edge + 1) % 3]}`;
      walked.set(key, (walked.get(key) ?? 0) + 1);
    }
  }
  return [...walked.entries()].every(([key, count]) => {
    const [a, b] = key.split(">");
    return count === 1 && walked.get(`${b}>${a}`) === 1;
  });
}

function signedVolume(position: { count: number; getX: (index: number) => number; getY: (index: number) => number; getZ: (index: number) => number }) {
  let volume = 0;
  for (let i = 0; i + 2 < position.count; i += 3) {
    const ax = position.getX(i), ay = position.getY(i), az = position.getZ(i);
    const bx = position.getX(i + 1), by = position.getY(i + 1), bz = position.getZ(i + 1);
    const cx = position.getX(i + 2), cy = position.getY(i + 2), cz = position.getZ(i + 2);
    volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return volume / 6;
}

describe("crescent geometry", () => {
  it("creates a closed, watertight 2-manifold crescent moon with sharp tips", () => {
    const geometry = createCrescentGeometry({
      width: 40,
      depth: 40,
      height: 10,
      crescentThickness: 14,
      crescentTipFillet: 0,
      crescentQuality: 32,
    });
    const position = geometry.getAttribute("position");

    expect(position.count).toBeGreaterThan(40);
    expect(signedVolume(position)).toBeGreaterThan(0);
    expect([...edgeUseCounts(position).values()].every((uses) => uses === 2)).toBe(true);
    expect(directedEdgesPaired(position)).toBe(true);

    expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 4);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(10, 4);
    expect((geometry.boundingBox?.max.x ?? 0) - (geometry.boundingBox?.min.x ?? 0)).toBeCloseTo(40, 2);
    expect((geometry.boundingBox?.max.z ?? 0) - (geometry.boundingBox?.min.z ?? 0)).toBeCloseTo(40, 2);
  });

  it("creates a closed, watertight 2-manifold crescent moon with rounded tips", () => {
    const geometry = createCrescentGeometry({
      width: 50,
      depth: 50,
      height: 12,
      crescentThickness: 18,
      crescentTipFillet: 2,
      crescentQuality: 32,
    });
    const position = geometry.getAttribute("position");

    expect(signedVolume(position)).toBeGreaterThan(0);
    expect([...edgeUseCounts(position).values()].every((uses) => uses === 2)).toBe(true);
    expect(directedEdgesPaired(position)).toBe(true);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 4);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(12, 4);
  });

  it("keeps lids and walls facing the same way at the default size and fillet", () => {
    for (const size of [{ width: 100, depth: 70, height: 3 }, { width: 40, depth: 40, height: 10 }]) {
      const position = createCrescentGeometry(size).getAttribute("position");
      expect(directedEdgesPaired(position)).toBe(true);
      expect(signedVolume(position)).toBeGreaterThan(0);
    }
  });

  it("participates cleanly in CSG boolean operations", () => {
    const crescentGeom = createCrescentGeometry({
      width: 30,
      depth: 30,
      height: 10,
      crescentThickness: 10,
      crescentTipFillet: 1,
      crescentQuality: 16,
    });
    const boxGeom = new THREE.BoxGeometry(40, 10, 40);
    boxGeom.translate(0, 5, 0);

    const boxBrush = new Brush(boxGeom);
    const crescentBrush = new Brush(crescentGeom);
    boxBrush.updateMatrixWorld(true);
    crescentBrush.updateMatrixWorld(true);

    const evaluator = new Evaluator();
    evaluator.useGroups = false;
    evaluator.attributes = ["position", "normal"];
    const result = evaluator.evaluate(boxBrush, crescentBrush, SUBTRACTION);
    const pos = result.geometry.getAttribute("position");
    expect(pos.count).toBeGreaterThan(0);
    expect(signedVolume(pos)).toBeGreaterThan(0);
  });

  it("normalizes crescent settings cleanly", () => {
    expect(normalizeCrescentTipFillet(-1)).toBe(0);
    expect(normalizeCrescentTipFillet(50)).toBe(8);
    expect(normalizeCrescentTipFillet(undefined)).toBe(0.5);

    expect(normalizeCrescentThickness(undefined, 40)).toBe(14);
    expect(normalizeCrescentThickness(100, 40)).toBe(34);
    expect(normalizeCrescentThickness(-5, 40)).toBe(1);

    expect(normalizeCrescentQuality(4)).toBe(16);
    expect(normalizeCrescentQuality(100)).toBe(64);
    expect(normalizeCrescentQuality(undefined)).toBe(32);

    const settings = crescentSettings({
      width: 40,
      depth: 40,
      crescentThickness: 12,
      crescentTipFillet: 1.5,
      crescentQuality: 24,
    });
    expect(settings).toEqual({
      thickness: 12,
      tipFillet: 1.5,
      quality: 24,
    });
  });
});
