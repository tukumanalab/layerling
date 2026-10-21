// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importModelFiles } from "@/lib/modelImport";
import { PICTURE_IMPORT_WIDTH } from "@/lib/pictureIcon";

/*
 * #359: a PNG or JPG in the import window comes in traced into an outline, 50 mm wide, and so does
 * an SVG that holds nothing but one picture. jsdom draws no pictures, so the browser's drawing is
 * stood in for by a fixed one: a black ring on white, 80 x 40 pixels, ring 30 px across.
 */

const WIDTH = 80;
const HEIGHT = 40;

function ringPixels() {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const r = Math.hypot(x + 0.5 - 40, y + 0.5 - 20);
      const ink = r <= 15 && r >= 7;
      data.set(ink ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * WIDTH + x) * 4);
    }
  }
  return data;
}

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const svgFile = (name: string, href: string) => new File([`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 50"><image width="100" height="50" xlink:href="${href}"/></svg>`], name, { type: "image/svg+xml" });

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", async () => ({ width: WIDTH, height: HEIGHT, close: () => {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
    drawImage: () => {},
    getImageData: () => ({ data: ringPixels() }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a picture through the import window (#359)", () => {
  it("brings a PNG in as its traced outline, 50 mm wide, kept as an SVG", async () => {
    const result = (await importModelFiles([new File([new Uint8Array([137, 80, 78, 71])], "ring.png", { type: "image/png" })]))!;
    expect(result.failures).toEqual([]);
    expect(result.shapes).toHaveLength(1);
    const [shape] = result.shapes;
    expect(shape.name).toBe("ring");
    expect(shape.width).toBeCloseTo(PICTURE_IMPORT_WIDTH, 0);
    expect(shape.depth).toBeCloseTo(PICTURE_IMPORT_WIDTH, 0);
    expect(result.assets[0].name).toBe("ring.svg");
    expect(result.assets[0].sourceFormat).toBe("svg");
    expect(new TextDecoder().decode(result.assets[0].bytes)).toContain("<path");
  });

  it("takes a JPG by its name too", async () => {
    const result = (await importModelFiles([new File([new Uint8Array([255, 216, 255])], "ring.JPG")]))!;
    expect(result.failures).toEqual([]);
    expect(result.shapes[0].width).toBeCloseTo(PICTURE_IMPORT_WIDTH, 0);
  });

  it("traces an SVG that holds nothing but one picture, and leaves a link to a file outside alone", async () => {
    const embedded = (await importModelFiles([svgFile("logo.svg", PNG)]))!;
    expect(embedded.failures).toEqual([]);
    expect(embedded.shapes[0].width).toBeCloseTo(PICTURE_IMPORT_WIDTH, 0);
    const linked = (await importModelFiles([svgFile("logo.svg", "logo.png")]))!;
    expect(linked.shapes).toHaveLength(0);
    expect(linked.failures[0].reason).toMatch(/SVG external references/);
  });
});
