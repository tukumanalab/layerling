// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildSvgExtrusionFromPaths, parseSvgForImport } from "@/lib/svgImport";

/** How many distinct corners the outline of the top face has: the sides of the polygon an ellipse became. */
function outlineCorners(source: string) {
  const { rawPositions } = buildSvgExtrusionFromPaths(parseSvgForImport(source).paths);
  const top = Math.max(...rawPositions.filter((_, index) => index % 3 === 1));
  const corners = new Set<string>();
  for (let index = 0; index < rawPositions.length; index += 3) {
    if (Math.abs(rawPositions[index + 1] - top) > 1e-6) continue;
    corners.add(`${rawPositions[index].toFixed(3)},${rawPositions[index + 2].toFixed(3)}`);
  }
  return corners.size;
}

describe("a circle imports round (#420)", () => {
  const ellipse = (radius: number, size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><ellipse cx="${size / 2}" cy="${size / 2}" rx="${radius}" ry="${radius}" style="fill:#000000"/></svg>`;

  it("a large circle has far more than the old 32 corners", () => {
    expect(outlineCorners(ellipse(106, 220))).toBeGreaterThan(200);
  });

  it("a small circle on a large drawing keeps the old number of pieces (two arcs of 32)", () => {
    // A small hole in a big plate: its pieces follow its own length, so it stays as light as before.
    const plate = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><path style="fill:#000000" fill-rule="evenodd" d="M0,0 L220,0 L220,220 L0,220 Z M108,110 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0 Z"/></svg>`;
    expect(outlineCorners(plate)).toBeLessThanOrEqual(70);
  });
});
