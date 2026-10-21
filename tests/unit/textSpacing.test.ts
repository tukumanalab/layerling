import { beforeAll, describe, expect, it } from "vitest";
import { textLetterSize, textLetterSizePatch, textSpacingPatch } from "@/lib/nameTag";
import { loadTextFonts, textFont } from "@/lib/textFonts";
import { curvedTextFootprint, spacedFont, textGlyphShapes, textLayoutFont } from "@/lib/textGeometry";
import type { WorkplaneShape } from "@/types/layerling";

// #594: the space between the letters, on top of the font's own, in per cent of the letter size.
const text = (overrides: Partial<WorkplaneShape> = {}): WorkplaneShape => ({
  id: "t", name: "Text", kind: "text", color: "#ff0000", x: 0, z: 0, elevation: 0, rotation: 0,
  width: 60, depth: 12, height: 3, size: 60, text: "HELLO", font: "Sans", ...overrides,
});

function lineWidth(font: ReturnType<typeof textFont>, words: string, size: number) {
  let min = Infinity;
  let max = -Infinity;
  font.generateShapes(words, size).forEach((glyph) => glyph.extractPoints(8).shape.forEach((point) => {
    min = Math.min(min, point.x);
    max = Math.max(max, point.x);
  }));
  return max - min;
}

describe("the space between the letters (#594)", () => {
  beforeAll(async () => {
    await loadTextFonts();
  });

  it("widens and tightens the line by the percentage between each pair of letters", () => {
    const font = textFont("Sans");
    const plain = lineWidth(font, "HELLO", 20);
    // Four gaps in HELLO, 50 per cent of a 20 mm letter size each.
    expect(lineWidth(spacedFont(font, 50), "HELLO", 20) - plain).toBeCloseTo(4 * 10, 1);
    expect(lineWidth(spacedFont(font, -10), "HELLO", 20) - plain).toBeCloseTo(4 * -2, 1);
    expect(lineWidth(spacedFont(font, 0), "HELLO", 20)).toBeCloseTo(plain, 6);
  });

  it("changes nothing for one letter and keeps the font itself as it was", () => {
    const font = textFont("Sans");
    expect(lineWidth(spacedFont(font, 80), "H", 20)).toBeCloseTo(lineWidth(font, "H", 20), 6);
    expect(spacedFont(font, 0)).toBe(font);
    expect(spacedFont(font, 30)).toBe(spacedFont(font, 30));
  });

  it("is left out for Arabic and Hebrew, whose letters join up", () => {
    const arabic = text({ text: "مرحبا", textSpacing: 100 });
    expect(textLayoutFont(arabic)).toBe(textFont("Sans"));
    expect(textLayoutFont(text({ textSpacing: 100 }))).not.toBe(textFont("Sans"));
  });

  it("makes the glyphs of a straight text stand further apart", () => {
    const span = (shape: WorkplaneShape) => {
      const glyphs = textGlyphShapes(shape)!.glyphs;
      const xs = glyphs.flatMap(({ glyph, map }) => glyph.extractPoints(8).shape.map((point) => map(point).x));
      return Math.max(...xs) - Math.min(...xs);
    };
    // The box is as it was, so the letters shrink to fit: compare the same text with a box that grew by the line's growth.
    const plain = span(text({ width: 200, depth: 12, size: 200 }));
    const wide = span(text({ width: 200, depth: 12, size: 200, textSpacing: 100 }));
    expect(wide).toBeGreaterThan(plain * 0.9);
  });

  it("keeps the letters as tall as they were: the box follows the line", () => {
    // A text whose box is the one its line needs at a letter size of 8 mm.
    const base = text();
    const shape = { ...base, ...textLetterSizePatch(base, 8) } as WorkplaneShape;
    const before = textLetterSize(shape);
    const patch = textSpacingPatch(shape, 40);
    const spaced = { ...shape, ...patch } as WorkplaneShape;
    expect(patch.textSpacing).toBe(40);
    expect(spaced.width).toBeGreaterThan(shape.width);
    expect(textLetterSize(spaced)).toBeCloseTo(before, 3);
    // Back to 0 takes the spacing away again and the box with it.
    const back = { ...spaced, ...textSpacingPatch(spaced, 0) } as WorkplaneShape;
    expect(back.textSpacing).toBeUndefined();
    expect(back.width).toBeCloseTo(shape.width, 3);
  });

  it("re-measures the box of curved text", () => {
    const shape = text({ textCurved: true, textRadius: 30, textSize: 8 });
    const wide = { ...shape, ...textSpacingPatch(shape, 60) } as WorkplaneShape;
    expect(wide.textSpacing).toBe(60);
    expect(curvedTextFootprint(wide).width).toBeGreaterThan(curvedTextFootprint(shape).width);
  });
});
