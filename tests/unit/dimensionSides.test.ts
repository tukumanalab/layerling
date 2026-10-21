import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ownSideForMark } from "@/lib/dimensionSides";

// The frame of a body turned by `degrees` about the vertical axis (its own sides), and the workplane's.
function frame(degrees: number) {
  const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(degrees));
  return { xAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion), zAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion) };
}

describe("which side of a body a mark on its edge belongs to (#419)", () => {
  const workplane = frame(0);

  it("keeps width and depth for a body that lies along the workplane", () => {
    expect(ownSideForMark(workplane, frame(0), "width")?.axis).toBe("width");
    expect(ownSideForMark(workplane, frame(0), "depth")?.axis).toBe("depth");
    expect(ownSideForMark(workplane, frame(180), "width")?.axis).toBe("width");
  });

  it("swaps them for a body turned by a quarter", () => {
    expect(ownSideForMark(workplane, frame(90), "width")?.axis).toBe("depth");
    expect(ownSideForMark(workplane, frame(90), "depth")?.axis).toBe("width");
    expect(ownSideForMark(workplane, frame(270), "width")?.axis).toBe("depth");
  });

  it("gives no side for a body that lies across the workplane", () => {
    expect(ownSideForMark(workplane, frame(45), "width")).toBeNull();
    expect(ownSideForMark(workplane, frame(30), "depth")).toBeNull();
  });

  it("reads the held edge in the body's own frame", () => {
    // The right edge of the workplane's frame (+x) is the body's depth edge on one side, for a body turned by a quarter.
    const turned = ownSideForMark(workplane, frame(90), "width")!;
    const own = turned.convertSigns({ x: 1, z: 0 });
    expect(own.x).toBe(0);
    expect(Math.abs(own.z)).toBe(1);
    const same = ownSideForMark(workplane, frame(0), "width")!;
    expect(same.convertSigns({ x: -1, z: 1 })).toEqual({ x: -1, z: 1 });
    const flipped = ownSideForMark(workplane, frame(180), "width")!;
    expect(flipped.convertSigns({ x: 1, z: 1 })).toEqual({ x: -1, z: -1 });
  });
});

describe("a body laid on its side: the vertical mark (#480)", () => {
  // The frame of a body turned by `degrees` about the X axis: its own depth then runs up, its height along the plate.
  const aboutX = (degrees: number) => {
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(degrees));
    return {
      xAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
      yAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion),
      zAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
    };
  };
  const workplane = aboutX(0);

  it("keeps height for the vertical mark of an upright body", () => {
    expect(ownSideForMark(workplane, aboutX(0), "height")?.axis).toBe("height");
    expect(ownSideForMark(workplane, aboutX(180), "height")?.axis).toBe("height");
  });

  it("gives the vertical mark of a body laid on its side to its depth, and the mark along the plate to its height", () => {
    expect(ownSideForMark(workplane, aboutX(90), "height")?.axis).toBe("depth");
    expect(ownSideForMark(workplane, aboutX(90), "depth")?.axis).toBe("height");
    expect(ownSideForMark(workplane, aboutX(270), "height")?.axis).toBe("depth");
    expect(ownSideForMark(workplane, aboutX(90), "width")?.axis).toBe("width");
  });

  it("gives no side for a body tilted by some other angle", () => {
    expect(ownSideForMark(workplane, aboutX(45), "height")).toBeNull();
  });

  it("does not guess a height without the body's own up axis", () => {
    expect(ownSideForMark(workplane, { xAxis: workplane.xAxis, zAxis: workplane.zAxis }, "height")).toBeNull();
  });
});
