import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeViewCubePosition,
  VIEW_CUBE_POSITION_BOOT_SCRIPT,
  VIEW_CUBE_POSITION_OPTIONS,
} from "../../apps/web/src/lib/viewCubePosition";

const css = readFileSync(path.resolve(__dirname, "../../apps/web/src/app/viewCube.css"), "utf8");

describe("view cube position", () => {
  it("falls back to the top left for anything it does not know", () => {
    expect(normalizeViewCubePosition("bottom-right")).toBe("bottom-right");
    expect(normalizeViewCubePosition("middle")).toBe("top-left");
    expect(normalizeViewCubePosition(null)).toBe("top-left");
  });

  it("restores every corner but the default before the page paints", () => {
    for (const position of VIEW_CUBE_POSITION_OPTIONS) {
      expect(VIEW_CUBE_POSITION_BOOT_SCRIPT.includes(`"${position}"`)).toBe(position !== "top-left");
    }
  });

  it("places the cube in every other corner and moves the camera controls up", () => {
    for (const position of VIEW_CUBE_POSITION_OPTIONS.filter((option) => option !== "top-left")) {
      expect(css).toContain(`html[data-view-cube-position="${position}"] .view-cube`);
    }
    expect(css).toMatch(/html\[data-view-cube-position\] \.camera-controls \{\s*top: 22px;/);
  });

  it("keeps the cube in the top left and hides the setting on a phone-wide window", () => {
    const wide = css.indexOf("@media (min-width: 641px) {");
    expect(wide).toBeGreaterThan(-1);
    expect(css.indexOf("html[data-view-cube-position]")).toBeGreaterThan(wide);
    expect(css).toMatch(/@media \(max-width: 640px\) \{\s*\.view-cube-position-setting \{\s*display: none;/);
  });
});
