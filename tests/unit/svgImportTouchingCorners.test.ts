// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import manifoldModule from "manifold-3d";
import { rememberManifoldRuntime } from "@/lib/manifoldHandle";
import { importedShapeFromSvgWithReport } from "@/lib/svgImport";

beforeAll(async () => {
  const runtime = await manifoldModule();
  runtime.setup();
  rememberManifoldRuntime(runtime);
});

describe("outlines that meet in a single corner (#584)", () => {
  // Two pieces of a traced picture (cut from a real one): they touch in the one point (40, 154) and nowhere else.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"><path fill="#000" fill-rule="evenodd" d="M 57,150 L 52,154 L 51,154 L 46,157 L 43,157 L 42,158 L 39,158 L 38,157 L 38,156 L 40,154 L 41,155 L 42,155 L 43,154 L 45,154 L 46,153 L 47,153 L 52,150 L 54,150 L 55,149 L 56,149 Z M 38,148 L 41,151 L 41,153 L 40,154 L 38,152 L 38,151 L 37,150 L 37,149 Z"/></svg>`;

  it("leaves no shape out and keeps both pieces", () => {
    const report = importedShapeFromSvgWithReport("touching.svg", svg);
    expect(report.skippedShapes).toBe(0);
    expect(report.shape.width).toBeGreaterThan(19);
    expect(report.shape.depth).toBeGreaterThan(9);
  });
});
