import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import {
  QR_BYTE_CAPACITY,
  QR_CORNER_BRIDGE,
  QR_ERROR_CORRECTIONS,
  QR_MIN_PRINTABLE_MODULE,
  normalizeQrSettings,
  qrByteLength,
  qrMatrix,
  qrModuleSize,
  qrModuleTooSmall,
  qrOutlineArea,
  qrOutlines,
  qrPreviewSvg,
  qrRectangles,
  qrSettingsEqual,
  qrSketchProfile,
  qrTextFits,
  type QrErrorCorrection,
} from "@/lib/qrCode";
import { cadSketchRegions, orderedCadSketchPaths } from "@/lib/sketchCadProfile";

const darkCount = (matrix: boolean[][]) => matrix.reduce((sum, row) => sum + row.filter(Boolean).length, 0);

/** The code drawn as grey pixels with its quiet zone, as a phone camera would see it, and read back. */
function decode(matrix: boolean[][], scale = 4) {
  const margin = 4;
  const size = (matrix.length + 2 * margin) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  matrix.forEach((row, y) => row.forEach((isDark, x) => {
    if (!isDark) return;
    for (let dy = 0; dy < scale; dy += 1) {
      for (let dx = 0; dx < scale; dx += 1) {
        const index = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
        pixels[index] = 0;
        pixels[index + 1] = 0;
        pixels[index + 2] = 0;
      }
    }
  }));
  const result = jsQR(pixels, size, size);
  return result ? new TextDecoder().decode(new Uint8Array(result.binaryData)) : null;
}

/** The dark modules as rectangles drawn into a grid - to compare them with the modules. */
function paint(size: number, rectangles: { x: number; y: number; width: number; height: number }[]) {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  rectangles.forEach((rect) => {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) for (let x = rect.x; x < rect.x + rect.width; x += 1) grid[y][x] += 1;
  });
  return grid;
}

describe("QR code encoder", () => {
  it("makes the smallest version that holds the text", () => {
    // Reference sizes from the byte-mode capacity table: version 1 is 21 modules, each version adds 4;
    // 100 bytes need version 6 at M (up to 106 bytes) and version 10 at H (up to 119 bytes).
    expect(qrMatrix("HELLO", "M")).toHaveLength(21);
    expect(qrMatrix("https://layerling.com", "M")).toHaveLength(25);
    expect(qrMatrix("a".repeat(100), "M")).toHaveLength(41);
    expect(qrMatrix("a".repeat(100), "H")).toHaveLength(57);
    expect(qrMatrix("a".repeat(QR_BYTE_CAPACITY.M), "M")).toHaveLength(177);
  });

  it("draws the three finder patterns in the corners", () => {
    const matrix = qrMatrix("HELLO", "M");
    const n = matrix.length;
    for (const [top, left] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      // A finder: a dark 7x7 ring, a light ring, a dark 3x3 middle.
      for (let i = 0; i < 7; i += 1) {
        expect(matrix[top][left + i]).toBe(true);
        expect(matrix[top + 6][left + i]).toBe(true);
        expect(matrix[top + i][left]).toBe(true);
        expect(matrix[top + i][left + 6]).toBe(true);
      }
      expect(matrix[top + 1][left + 1]).toBe(false);
      expect(matrix[top + 3][left + 3]).toBe(true);
    }
    // No finder in the fourth corner.
    expect(matrix[n - 1].slice(n - 7).every(Boolean)).toBe(false);
  });

  it("refuses an empty text and one too long", () => {
    expect(() => qrMatrix("", "M")).toThrow();
    expect(() => qrMatrix("a".repeat(QR_BYTE_CAPACITY.H + 1), "H")).toThrow();
  });
});

describe("QR capacity", () => {
  it("counts bytes as UTF-8", () => {
    expect(qrByteLength("abc")).toBe(3);
    expect(qrByteLength("Grüße")).toBe(7);
  });

  it("knows the limits of each level", () => {
    for (const level of QR_ERROR_CORRECTIONS) {
      expect(qrTextFits("a".repeat(QR_BYTE_CAPACITY[level]), level)).toBe(true);
      expect(qrTextFits("a".repeat(QR_BYTE_CAPACITY[level] + 1), level)).toBe(false);
    }
    expect(QR_BYTE_CAPACITY.L).toBeGreaterThan(QR_BYTE_CAPACITY.M);
    expect(QR_BYTE_CAPACITY.Q).toBeGreaterThan(QR_BYTE_CAPACITY.H);
    // An umlaut takes two bytes, so fewer of them fit.
    expect(qrTextFits("ü".repeat(QR_BYTE_CAPACITY.H / 2 + 1), "H")).toBe(false);
  });
});

describe("QR module size", () => {
  it("divides the width by the modules, the quiet zone only on a plate", () => {
    expect(qrModuleSize(21, 42, "code", true)).toBeCloseTo(2);
    expect(qrModuleSize(21, 29, "raised", true)).toBeCloseTo(1);
    expect(qrModuleSize(21, 21, "engraved", false)).toBeCloseTo(1);
  });

  it("warns below the rule of thumb", () => {
    expect(qrModuleTooSmall(QR_MIN_PRINTABLE_MODULE)).toBe(false);
    expect(qrModuleTooSmall(0.79)).toBe(true);
    expect(qrModuleTooSmall(1.2)).toBe(false);
    // 100 characters at M: 41 modules - 0.8 mm each in 33 mm, too small in 32 mm.
    expect(qrModuleTooSmall(qrModuleSize(41, 33, "code", true))).toBe(false);
    expect(qrModuleTooSmall(qrModuleSize(41, 32, "code", true))).toBe(true);
  });
});

describe("QR rectangles", () => {
  it("cover every dark module exactly once and no light one", () => {
    for (const text of ["HELLO", "https://layerling.com/guide", "Grüße aus Köln"]) {
      const matrix = qrMatrix(text, "Q");
      const rectangles = qrRectangles(matrix);
      const grid = paint(matrix.length, rectangles);
      matrix.forEach((row, y) => row.forEach((isDark, x) => expect(grid[y][x]).toBe(isDark ? 1 : 0)));
      expect(rectangles.reduce((sum, rect) => sum + rect.width * rect.height, 0)).toBe(darkCount(matrix));
      // Merging pays: far fewer rectangles than modules.
      expect(rectangles.length).toBeLessThan(darkCount(matrix) / 2);
    }
  });

  it("joins equal runs in the rows below", () => {
    const rectangles = qrRectangles([
      [true, true, false],
      [true, true, false],
      [false, true, true],
    ]);
    expect(rectangles).toEqual([
      { x: 0, y: 0, width: 2, height: 2 },
      { x: 1, y: 2, width: 2, height: 1 },
    ]);
  });
});

describe("QR outlines", () => {
  it("enclose the dark modules, plus only the tiny corner bridges", () => {
    for (const level of QR_ERROR_CORRECTIONS) {
      const matrix = qrMatrix("https://layerling.com", level);
      const loops = qrOutlines(matrix);
      const bridges = countDiagonalCorners(matrix);
      const bridgeArea = 2 * (QR_CORNER_BRIDGE * QR_CORNER_BRIDGE) * bridges;
      expect(qrOutlineArea(loops)).toBeCloseTo(darkCount(matrix) + bridgeArea, 6);
    }
  });

  it("have no point twice, so every outline is a clean loop", () => {
    const loops = qrOutlines(qrMatrix("Grüße aus Köln", "M"));
    for (const loop of loops) {
      const keys = loop.map((point) => `${point.x},${point.y}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const all = loops.flatMap((loop) => loop.map((point) => `${point.x},${point.y}`));
    expect(new Set(all).size).toBe(all.length);
  });

  it("bridge two modules that touch only at a corner", () => {
    const loops = qrOutlines([
      [true, false],
      [false, true],
    ]);
    expect(loops).toHaveLength(1);
    expect(qrOutlineArea(loops)).toBeCloseTo(2 + 2 * QR_CORNER_BRIDGE * QR_CORNER_BRIDGE, 9);
  });

  it("keep a light module inside a dark ring as a hole", () => {
    const loops = qrOutlines([
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ]);
    expect(loops).toHaveLength(2);
    expect(qrOutlineArea(loops)).toBeCloseTo(8, 9);
  });

  it("become a sketch the CAD worker reads as solids and holes, centred and the right way round", () => {
    const matrix = qrMatrix("HELLO", "M");
    const loops = qrOutlines(matrix);
    const profile = qrSketchProfile(loops, 2, matrix.length, 0);
    const paths = orderedCadSketchPaths(profile);
    expect(paths).toHaveLength(loops.length);
    expect(paths.every((path) => path.closed)).toBe(true);
    const regions = cadSketchRegions(profile);
    expect(regions.length).toBeGreaterThan(0);
    const xs = profile.points.map((point) => point.x);
    const zs = profile.points.map((point) => point.z);
    expect(Math.min(...xs)).toBeCloseTo(-21);
    expect(Math.max(...xs)).toBeCloseTo(21);
    expect(Math.min(...zs)).toBeCloseTo(-21);
    expect(Math.max(...zs)).toBeCloseTo(21);
    // The top-left finder: row 0 at the back (smallest z), column 0 on the left (smallest x).
    expect(profile.points.some((point) => Math.abs(point.x + 21) < 1e-6 && Math.abs(point.z + 21) < 1e-6)).toBe(true);
  });

  it("leave room for the quiet zone when offset", () => {
    const matrix = qrMatrix("HELLO", "M");
    const profile = qrSketchProfile(qrOutlines(matrix), 1, matrix.length + 8, 4);
    const xs = profile.points.map((point) => point.x);
    expect(Math.min(...xs)).toBeCloseTo(-10.5);
    expect(Math.max(...xs)).toBeCloseTo(10.5);
  });
});

describe("QR codes read back", () => {
  const texts = {
    url: "https://layerling.com/?editor=1",
    short: "Hi",
    umlauts: "Grüße aus Köln – ÄÖÜß",
    hundred: "0123456789abcdefghijklmnopqrstuvwxyz".repeat(3).slice(0, 100),
  };

  for (const [name, text] of Object.entries(texts)) {
    it(`reads ${name} at level M`, () => {
      expect(decode(qrMatrix(text, "M"))).toBe(text);
    });
  }

  for (const level of QR_ERROR_CORRECTIONS) {
    it(`reads every level: ${level}`, () => {
      expect(decode(qrMatrix(texts.url, level as QrErrorCorrection))).toBe(texts.url);
    });
  }

  it("reads the preview picture's rectangles as the same code", () => {
    const matrix = qrMatrix(texts.umlauts, "Q");
    const painted = paint(matrix.length, qrRectangles(matrix)).map((row) => row.map((value) => value > 0));
    expect(decode(painted)).toBe(texts.umlauts);
    expect(qrPreviewSvg(matrix, true)).toContain(`viewBox="0 0 ${matrix.length + 8} ${matrix.length + 8}"`);
  });
});

describe("QR settings", () => {
  it("are made safe, and none without a text", () => {
    expect(normalizeQrSettings(null)).toBeNull();
    expect(normalizeQrSettings({ text: "" })).toBeNull();
    expect(normalizeQrSettings({ text: "Hi" })).toEqual({ text: "Hi", errorCorrection: "M", quietZone: true, style: "code", codeHeight: 4, plateThickness: 3 });
    expect(normalizeQrSettings({ text: "Hi", errorCorrection: "X", style: "raised", codeHeight: 900, quietZone: false })).toEqual({
      text: "Hi", errorCorrection: "M", quietZone: false, style: "raised", codeHeight: 50, plateThickness: 3,
    });
  });

  it("compare by every field", () => {
    const base = normalizeQrSettings({ text: "Hi" })!;
    expect(qrSettingsEqual(base, { ...base })).toBe(true);
    expect(qrSettingsEqual(base, { ...base, text: "Ho" })).toBe(false);
    expect(qrSettingsEqual(base, { ...base, errorCorrection: "H" })).toBe(false);
    expect(qrSettingsEqual(undefined, undefined)).toBe(true);
    expect(qrSettingsEqual(base, undefined)).toBe(false);
  });
});

/** Corners where only one diagonal pair of the four modules round it is dark. */
function countDiagonalCorners(matrix: boolean[][]) {
  const n = matrix.length;
  const dark = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && matrix[r][c];
  let count = 0;
  for (let r = 1; r < n; r += 1) {
    for (let c = 1; c < n; c += 1) {
      const tl = dark(r - 1, c - 1);
      const tr = dark(r - 1, c);
      const bl = dark(r, c - 1);
      const br = dark(r, c);
      if ((tl && br && !tr && !bl) || (tr && bl && !tl && !br)) count += 1;
    }
  }
  return count;
}
