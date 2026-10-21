// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { scaleSvgText } from "@/lib/svgScale";
import { readImportSvgWidth, setImportSvgWidth, takeImportSvgWidth } from "@/lib/importPreferences";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10"/><circle cx="5" cy="5" r="2"/></svg>';

describe("an SVG scaled to a width typed at the import (#448)", () => {
  it("wraps everything in one scaling group and keeps the root", () => {
    const scaled = scaleSvgText(SVG, 2.5);
    const root = new DOMParser().parseFromString(scaled, "image/svg+xml").documentElement;
    expect(root.localName).toBe("svg");
    expect(root.children).toHaveLength(1);
    const group = root.children[0];
    expect(group.localName).toBe("g");
    expect(group.getAttribute("transform")).toBe("scale(2.5)");
    expect(group.querySelector("rect")).not.toBeNull();
    expect(group.querySelector("circle")).not.toBeNull();
  });

  it("leaves the text alone for a factor of one, or one that makes no sense", () => {
    expect(scaleSvgText(SVG, 1)).toBe(SVG);
    expect(scaleSvgText(SVG, 0)).toBe(SVG);
    expect(scaleSvgText(SVG, Number.NaN)).toBe(SVG);
    expect(scaleSvgText("not an svg", 2)).toBe("not an svg");
  });
});

describe("the width typed in the import window counts once", () => {
  it("is taken by the import and gone afterwards", () => {
    setImportSvgWidth(60);
    expect(readImportSvgWidth()).toBe(60);
    expect(takeImportSvgWidth()).toBe(60);
    expect(takeImportSvgWidth()).toBeNull();
  });

  it("ignores nonsense", () => {
    setImportSvgWidth(-5);
    expect(readImportSvgWidth()).toBeNull();
    setImportSvgWidth(Number.NaN);
    expect(readImportSvgWidth()).toBeNull();
    setImportSvgWidth(null);
    expect(takeImportSvgWidth()).toBeNull();
  });
});
