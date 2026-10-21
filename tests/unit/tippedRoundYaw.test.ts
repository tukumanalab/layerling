import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { quaternionForShape } from "@/lib/geometryRotation";
import { shapeYawDegrees } from "@/lib/stepExport";
import { meshForShape } from "@/lib/editorMeshCore";
import { meshYawDegrees } from "@/lib/workplaneShapes";
import type { WorkplaneShape } from "@/types/layerling";

const cylinder = (extra: Partial<WorkplaneShape>) => ({ id: "c", name: "C", kind: "cylinder", x: 0, z: 0, size: 6, width: 6, depth: 6, height: 10, rotation: 0, ...extra }) as WorkplaneShape;

/** Where the cylinder's own axis points in the world with this yaw. */
const axisWith = (shape: WorkplaneShape, yaw: number) => new THREE.Vector3(0, 1, 0).applyQuaternion(quaternionForShape({ ...shape, rotation: yaw }));

describe("the yaw of a round body that lies on its side (forum 617836)", () => {
  it("keeps the yaw of a cylinder tipped about Z: it decides where it points", () => {
    for (const rotation of [0, 45, 120, 240]) {
      const pin = cylinder({ rotationZ: 90, rotation });
      expect(meshYawDegrees(pin)).toBe(rotation);
      expect(shapeYawDegrees(pin)).toBe(rotation);
      // What the mesh and STEP use points where the view shows it.
      expect(axisWith(pin, meshYawDegrees(pin)).distanceTo(axisWith(pin, rotation))).toBeLessThan(1e-9);
    }
  });

  it("keeps the yaw of a standing cylinder that is tapered or leaning: its taper follows its own axes (#504)", () => {
    const tapered = cylinder({ rotation: 90, taperTopWidth: 3, taperTopDepth: 6 });
    const leaning = cylinder({ rotation: 90, extrudeTopOffsetX: 5 });
    const twisted = cylinder({ rotation: 90, extrudeTwist: 30 });
    for (const shape of [tapered, leaning, twisted]) {
      expect(meshYawDegrees(shape)).toBe(90);
      expect(shapeYawDegrees(shape)).toBe(90);
    }
  });

  it("lays a tapered cylinder turned by 90 degrees across the other axis in its mesh", () => {
    const top = (shape: WorkplaneShape) => {
      const vertices = meshForShape(shape).vertices.filter((vertex) => vertex[1] > shape.height - 1e-6);
      const xs = vertices.map((vertex) => vertex[0]);
      const zs = vertices.map((vertex) => vertex[2]);
      return { x: Math.max(...xs) - Math.min(...xs), z: Math.max(...zs) - Math.min(...zs) };
    };
    const straight = top(cylinder({ rotation: 0, taperTopWidth: 3, taperTopDepth: 6 }));
    const turned = top(cylinder({ rotation: 90, taperTopWidth: 3, taperTopDepth: 6 }));
    expect(straight.x).toBeCloseTo(3, 1);
    expect(straight.z).toBeCloseTo(6, 1);
    expect(turned.x).toBeCloseTo(6, 1);
    expect(turned.z).toBeCloseTo(3, 1);
  });

  it("still drops a yaw that only spins a standing (or X-tipped) cylinder about its own axis", () => {
    expect(meshYawDegrees(cylinder({ rotation: 90 }))).toBe(0);
    expect(shapeYawDegrees(cylinder({ rotation: 90 }))).toBe(0);
    const tippedX = cylinder({ rotationX: 90, rotation: 90 });
    expect(axisWith(tippedX, meshYawDegrees(tippedX)).distanceTo(axisWith(tippedX, 90))).toBeLessThan(1e-9);
  });
});
