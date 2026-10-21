import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { pivotKeptAhead, pivotHeightRange, pivotPlateReach, ZOOM_PIVOT_REACH_MM } from "@/lib/zoomPivot";

const limits = { halfWidth: 110, halfDepth: 110, minY: -70, maxY: 120 };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("keeping the pivot ahead of the camera while zooming at nothing", () => {
  it("leaves a pivot that is far enough ahead alone", () => {
    expect(pivotKeptAhead(v(0, 40, 200), v(0, 0, 0), v(0, -0.2, -1).normalize(), ZOOM_PIVOT_REACH_MM, limits)).toBeNull();
  });

  it("moves a pivot the camera has come close to out to the reach on the line of sight", () => {
    const forward = v(0, 0, -1);
    const next = pivotKeptAhead(v(0, 20, 30), v(0, 20, 20), forward, ZOOM_PIVOT_REACH_MM, limits)!;
    expect(next.distanceTo(v(0, 20, 30))).toBeCloseTo(ZOOM_PIVOT_REACH_MM, 6);
    expect(next.x).toBeCloseTo(0, 9);
    expect(next.z).toBeCloseTo(30 - ZOOM_PIVOT_REACH_MM, 6);
  });

  it("keeps the pivot inside the box it may be in, cutting the distance short along the line of sight", () => {
    const edge = pivotKeptAhead(v(0, 20, -80), v(0, 20, -90), v(0, 0, -1), ZOOM_PIVOT_REACH_MM, limits)!;
    expect(edge.z).toBe(-110);
    expect(pivotKeptAhead(v(0, 20, -109), v(0, 20, -110), v(0, 0, -1), ZOOM_PIVOT_REACH_MM, limits)).toBeNull();
  });

  it("never turns the view: the pivot stays on the line of sight, also near the back edge of a camera looking down a little", () => {
    const camera = v(10, 25, -95);
    const forward = v(0.05, -0.3, -0.95).normalize();
    const next = pivotKeptAhead(camera, v(10, 25, -99), forward, ZOOM_PIVOT_REACH_MM, limits)!;
    expect(next).not.toBeNull();
    const direction = next.clone().sub(camera).normalize();
    expect(direction.x).toBeCloseTo(forward.x, 9);
    expect(direction.y).toBeCloseTo(forward.y, 9);
    expect(direction.z).toBeCloseTo(forward.z, 9);
    expect(next.z).toBeGreaterThanOrEqual(-limits.halfDepth - 1e-9);
  });

});

describe("pivotHeightRange (#425)", () => {
  const base = { minY: -70, maxY: 120 };

  it("keeps the range the pivot always had when the bodies are low", () => {
    expect(pivotHeightRange([{ elevation: 0, extent: 30 }], base)).toEqual(base);
    expect(pivotHeightRange([], base)).toEqual(base);
  });

  it("reaches up to the top of a body set high above the plate", () => {
    expect(pivotHeightRange([{ elevation: 0, extent: 30 }, { elevation: 900, extent: 30 }], base)).toEqual({ minY: -70, maxY: 930 });
  });

  it("reaches down to the foot of a body sunk below the plate", () => {
    expect(pivotHeightRange([{ elevation: -400, extent: 30 }], base).minY).toBe(-400);
  });

  it("takes in the part the camera was last sent to", () => {
    expect(pivotHeightRange([], base, { minY: 300, maxY: 500 })).toEqual({ minY: -70, maxY: 500 });
  });
});

describe("how far to the sides the pivot may go", () => {
  const plate = { halfWidth: 110, halfDepth: 110 };

  it("stays on the plate when every body is on it", () => {
    expect(pivotPlateReach([{ x: 20, z: -30, extent: 40 }], plate)).toEqual(plate);
    expect(pivotPlateReach([], plate)).toEqual(plate);
  });

  it("reaches a body parked beside the plate, out to its far side (#502)", () => {
    const reach = pivotPlateReach([{ x: -400, z: 10, extent: 60 }], plate);
    expect(reach.halfWidth).toBe(430);
    expect(reach.halfDepth).toBe(110);
  });

  it("takes both directions from the farthest body, whatever side it lies on", () => {
    const reach = pivotPlateReach([{ x: 150, z: 20, extent: 20 }, { x: -50, z: -300, extent: 100 }], plate);
    expect(reach).toEqual({ halfWidth: 160, halfDepth: 350 });
  });
});
