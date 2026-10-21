import { beforeAll, describe, expect, it, vi } from "vitest";
import manifoldModule from "manifold-3d";
import type { WorkplaneShape } from "@/types/layerling";
import { exportBodiesWithLooseHoles, exportSolidVolume, unionOverlappingExportMeshes } from "@/lib/editorBooleans";
import { rememberManifoldRuntime } from "@/lib/manifoldHandle";
import { closedMeshVolume } from "@/lib/cadProfileExtrusion";

const kernel = vi.hoisted(() => ({ runtime: null as Promise<unknown> | null }));
vi.mock("@/lib/editorMeshCore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/editorMeshCore")>()),
  getManifoldRuntime: () => kernel.runtime,
}));
beforeAll(async () => {
  kernel.runtime = manifoldModule().then((runtime) => { runtime.setup(); rememberManifoldRuntime(runtime); return runtime; });
  await kernel.runtime;
});

const SIDES = 128, BLOCK = 20 * 20 * 10;
const block = (id: string, x: number) => ({ id, name: "Box", kind: "box", color: "#cf101b", x, z: 0, elevation: 0, rotation: 0, width: 20, depth: 20, size: 20, height: 10 } as WorkplaneShape);
const hole = (d: number, x: number) => ({ id: "hole", name: "Cylinder", kind: "cylinder", color: "#999999", x, z: 0, elevation: -1, rotation: 0, width: d, depth: d, size: d, height: 12, sides: SIDES, hole: true } as WorkplaneShape);
const holeVolume = (d: number) => ((SIDES / 2) * (d / 2) ** 2 * Math.sin((2 * Math.PI) / SIDES)) * 10;

describe("a loose hole in a body that touches another body", () => {
  it("control: one block, one hole", async () => {
    const r = await exportSolidVolume([block("a", 0), hole(8, 0)]);
    console.log("control", r.volumeMm3, "expected", BLOCK - holeVolume(8));
    expect(Math.abs(BLOCK - holeVolume(8) - r.volumeMm3)).toBeLessThan(2);
  });
  it.each([20, 15])("second block at x=%s: the hole stays cut in the export", async (xb) => {
    const shapes = [block("a", 0), block("b", xb), hole(8, 0)];
    const expected = 20 * 10 * (20 + xb) - holeVolume(8);
    const { solids, meshes, cut } = await exportBodiesWithLooseHoles(shapes);
    const cutVol = meshes.map((m) => Math.abs(closedMeshVolume(m.vertices, m.faces)));
    const joined = await unionOverlappingExportMeshes(solids, meshes, cut);
    const outVol = joined.meshes.reduce((s, m) => s + Math.abs(closedMeshVolume(m.vertices, m.faces)), 0);
    console.log(`xb=${xb} cut flags`, cut, "per-body volume after hole cut", cutVol.map((v) => v.toFixed(1)), "exported STL volume", outVol.toFixed(1), "expected", expected.toFixed(1), "merged bodies", joined.meshes.length);
    expect(Math.abs(outVol - expected)).toBeLessThan(2);
  });
});

import { colorSeparatedExportMeshes } from "@/lib/editorBooleans";
describe("the same in a 3MF/OBJ export (colour-separated)", () => {
  it("a same-colour touching body keeps the hole too", async () => {
    const shapes = [block("a", 0), block("b", 20), hole(8, 0)];
    const { solids, meshes, cut } = await exportBodiesWithLooseHoles(shapes);
    const joined = await colorSeparatedExportMeshes(solids, meshes, cut);
    const outVol = joined.meshes.reduce((s, m) => s + Math.abs(closedMeshVolume(m.vertices, m.faces)), 0);
    expect(Math.abs(outVol - (8000 - holeVolume(8)))).toBeLessThan(2);
  });
});
