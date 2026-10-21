import qrcode from "qrcode-generator";
import type { QrCodeSettings, QrErrorCorrection, QrStyle, SketchPoint, SketchProfile, SketchSegment } from "@/types/layerling";

export type { QrCodeSettings, QrErrorCorrection, QrStyle };

/**
 * QR codes (#553): a text or an address as a code to print. The encoding (Reed-Solomon, masks,
 * versions) is the `qrcode-generator` package's, MIT licensed; this file turns its modules into
 * geometry - rectangles for the preview, and the outline of all dark modules together for the
 * sketch body - and holds the numbers the window and the inspector check.
 */

export const QR_ERROR_CORRECTIONS: readonly QrErrorCorrection[] = ["L", "M", "Q", "H"];

export const QR_STYLES: readonly QrStyle[] = ["code", "raised", "engraved"];

export const DEFAULT_QR_WIDTH = 40;
export const MIN_QR_WIDTH = 5;
export const MAX_QR_WIDTH = 500;
/** A code alone stands 4 mm high. */
export const DEFAULT_QR_CODE_HEIGHT = 4;
/** On a plate the code is raised or engraved 1 mm into a 3 mm plate. */
export const DEFAULT_QR_RELIEF = 1;
export const DEFAULT_QR_PLATE_THICKNESS = 3;
export const MIN_QR_HEIGHT = 0.2;
export const MAX_QR_HEIGHT = 50;
/** The quiet zone the standard asks for: four modules on every side. */
export const QR_QUIET_MODULES = 4;
/**
 * Below this a module is hard to print readably with a 0.4 mm nozzle. A rule of thumb, not a promise:
 * printer, material and scanner all play a part.
 */
export const QR_MIN_PRINTABLE_MODULE = 0.8;

/** The most bytes a code holds at each level of error correction (version 40, byte mode). */
export const QR_BYTE_CAPACITY: Readonly<Record<QrErrorCorrection, number>> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

export const DEFAULT_QR_SETTINGS: QrCodeSettings = {
  text: "",
  errorCorrection: "M",
  quietZone: true,
  style: "code",
  codeHeight: DEFAULT_QR_CODE_HEIGHT,
  plateThickness: DEFAULT_QR_PLATE_THICKNESS,
};

/** How many bytes a text takes in the code: it is written as UTF-8, so an umlaut takes two. */
export function qrByteLength(text: string) {
  return new TextEncoder().encode(text).length;
}

/** Whether a text fits a code at this level of error correction. */
export function qrTextFits(text: string, errorCorrection: QrErrorCorrection) {
  return qrByteLength(text) <= QR_BYTE_CAPACITY[errorCorrection];
}

/** The modules of a code: rows top to bottom, true for dark. Throws for an empty text or one too long. */
export function qrMatrix(text: string, errorCorrection: QrErrorCorrection): boolean[][] {
  if (!text) throw new Error("A QR code needs a text");
  if (!qrTextFits(text, errorCorrection)) throw new Error("The text is too long for a QR code");
  // The package writes one byte per character; handing it the UTF-8 bytes as characters makes it
  // write the text as UTF-8, which phones read, without changing the package's own settings.
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const code = qrcode(0, errorCorrection);
  code.addData(binary, "Byte");
  code.make();
  const count = code.getModuleCount();
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, column) => code.isDark(row, column)));
}

/** The size of one module for a body `width` mm wide: on a plate with a quiet zone, the rim counts. */
export function qrModuleSize(moduleCount: number, width: number, style: QrStyle, quietZone: boolean) {
  const across = moduleCount + (style !== "code" && quietZone ? 2 * QR_QUIET_MODULES : 0);
  return width / Math.max(1, across);
}

/** Whether a module this size is likely too small to print readably (see QR_MIN_PRINTABLE_MODULE). */
export function qrModuleTooSmall(moduleSize: number) {
  return moduleSize < QR_MIN_PRINTABLE_MODULE - 1e-9;
}

export type QrRectangle = { x: number; y: number; width: number; height: number };

/**
 * The dark modules as few rectangles, in module units: runs along each row, and runs of the same
 * columns in the rows below joined into one. They cover exactly the dark modules, without gaps or
 * overlaps.
 */
export function qrRectangles(matrix: readonly (readonly boolean[])[]): QrRectangle[] {
  const done: QrRectangle[] = [];
  let open = new Map<string, QrRectangle>();
  matrix.forEach((row, y) => {
    const next = new Map<string, QrRectangle>();
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end += 1;
      const key = `${x}:${end}`;
      const above = open.get(key);
      if (above) {
        above.height += 1;
        next.set(key, above);
        open.delete(key);
      } else {
        next.set(key, { x, y, width: end - x, height: 1 });
      }
      x = end;
    }
    open.forEach((rectangle) => done.push(rectangle));
    open = next;
  });
  open.forEach((rectangle) => done.push(rectangle));
  return done.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** How far a bridge reaches from a corner where two dark modules meet only at their tips, as a share of a module. */
export const QR_CORNER_BRIDGE = 0.01;

export type QrOutline = { x: number; y: number }[];

/**
 * The outline of all dark modules together, in module units with y down: closed loops, the outer
 * edges of each dark area and the edges of the light areas inside it. Modules side by side are one
 * area, with no seam. Two dark modules that touch only at a corner would meet in a single point,
 * which no solid can; there a bridge 2 % of a module square joins them, so every code is a clean
 * solid. A scanner does not see it.
 */
export function qrOutlines(matrix: readonly (readonly boolean[])[], bridge = QR_CORNER_BRIDGE): QrOutline[] {
  const count = matrix.length;
  if (!count) return [];
  const dark = (row: number, column: number) => row >= 0 && column >= 0 && row < count && column < count && Boolean(matrix[row][column]);
  // A grid finer only next to the lines between modules: per module a thin strip at each side and its middle.
  const lines: number[] = [];
  for (let index = 0; index <= count; index += 1) {
    if (index > 0) lines.push(index - bridge);
    lines.push(index);
    if (index < count) lines.push(index + bridge);
  }
  const cells = lines.length - 1;
  /** The module a fine cell belongs to, along one axis. */
  const owner = (cell: number) => Math.floor((lines[cell] + lines[cell + 1]) / 2);
  const corner = (cell: number) => {
    // A fine cell next to a module corner: which corner line it touches, and on which side.
    const low = lines[cell];
    const high = lines[cell + 1];
    if (Math.abs(high - Math.round(high)) < 1e-12 && high - low < 0.5) return { line: Math.round(high), before: true };
    if (Math.abs(low - Math.round(low)) < 1e-12 && high - low < 0.5) return { line: Math.round(low), before: false };
    return null;
  };
  const filled = (row: number, column: number) => {
    const moduleRow = owner(row);
    const moduleColumn = owner(column);
    if (dark(moduleRow, moduleColumn)) return true;
    const cornerRow = corner(row);
    const cornerColumn = corner(column);
    if (!cornerRow || !cornerColumn) return false;
    // The four modules round this corner: a dark pair on one diagonal and a light pair on the other gets a bridge.
    const r = cornerRow.line;
    const c = cornerColumn.line;
    const topLeft = dark(r - 1, c - 1);
    const topRight = dark(r - 1, c);
    const bottomLeft = dark(r, c - 1);
    const bottomRight = dark(r, c);
    return (topLeft && bottomRight && !topRight && !bottomLeft) || (topRight && bottomLeft && !topLeft && !bottomRight);
  };
  const grid: boolean[][] = Array.from({ length: cells }, (_, row) => Array.from({ length: cells }, (_, column) => filled(row, column)));
  const inside = (row: number, column: number) => row >= 0 && column >= 0 && row < cells && column < cells && grid[row][column];

  // Every edge between a filled and an empty cell, walked with the filled side on the right (y down).
  type Edge = { from: string; to: string; ax: number; ay: number; bx: number; by: number };
  const outgoing = new Map<string, Edge>();
  const key = (column: number, row: number) => `${column},${row}`;
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const edge = { from: key(ax, ay), to: key(bx, by), ax, ay, bx, by };
    outgoing.set(edge.from, edge);
  };
  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      if (!grid[row][column]) continue;
      if (!inside(row - 1, column)) add(column, row, column + 1, row);
      if (!inside(row, column + 1)) add(column + 1, row, column + 1, row + 1);
      if (!inside(row + 1, column)) add(column + 1, row + 1, column, row + 1);
      if (!inside(row, column - 1)) add(column, row + 1, column, row);
    }
  }

  const loops: QrOutline[] = [];
  const used = new Set<string>();
  for (const [start, first] of outgoing) {
    if (used.has(start)) continue;
    const corners: { x: number; y: number }[] = [];
    let edge: Edge | undefined = first;
    let previous: { dx: number; dy: number } | null = null;
    while (edge && !used.has(edge.from)) {
      used.add(edge.from);
      const direction = { dx: Math.sign(edge.bx - edge.ax), dy: Math.sign(edge.by - edge.ay) };
      // Only the corners stay: a straight run of fine edges is one side.
      if (!previous || previous.dx !== direction.dx || previous.dy !== direction.dy) corners.push({ x: lines[edge.ax], y: lines[edge.ay] });
      previous = direction;
      edge = outgoing.get(edge.to);
    }
    // The walk began in the middle of a side when its first corner is no corner at all.
    if (corners.length >= 2 && previous) {
      const a = corners[corners.length - 1];
      const b = corners[0];
      const c = corners[1];
      const straight = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) === 0;
      if (straight) corners.shift();
    }
    if (corners.length >= 4) loops.push(corners);
  }
  return loops;
}

/** The area of a set of loops by the even-odd rule, in square module units. */
export function qrOutlineArea(loops: readonly QrOutline[]) {
  return Math.abs(loops.reduce((sum, loop) => sum + loop.reduce((area, point, index) => {
    const next = loop[(index + 1) % loop.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2, 0));
}

/**
 * Loops as a sketch profile, `moduleSize` mm a module, centred on the middle of a square `across`
 * modules wide (the code, or the code with its quiet zone). Sketch x runs right and z towards the
 * front, so the code reads the right way round seen from above, its first row at the back.
 */
export function qrSketchProfile(loops: readonly QrOutline[], moduleSize: number, across: number, offset: number, idPrefix = "qr"): SketchProfile {
  const points: SketchPoint[] = [];
  const segments: SketchSegment[] = [];
  const half = (across * moduleSize) / 2;
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  loops.forEach((loop, loopIndex) => {
    const ids = loop.map((_, index) => `${idPrefix}-${loopIndex}-${index}`);
    loop.forEach((point, index) => {
      points.push({ id: ids[index], x: round((point.x + offset) * moduleSize - half), z: round((point.y + offset) * moduleSize - half), mode: "corner" });
      segments.push({ id: `${ids[index]}-s`, startId: ids[index], endId: ids[(index + 1) % ids.length], kind: "line" });
    });
  });
  return { points, segments };
}

/** A square `size` mm wide centred on the origin, as a sketch profile: the plate. */
export function qrPlateProfile(size: number, idPrefix = "qr-plate"): SketchProfile {
  const half = size / 2;
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  const ids = corners.map((_, index) => `${idPrefix}-${index}`);
  return {
    points: corners.map(([x, z], index) => ({ id: ids[index], x, z, mode: "corner" as const })),
    segments: ids.map((id, index) => ({ id: `${id}-s`, startId: id, endId: ids[(index + 1) % ids.length], kind: "line" as const })),
  };
}

/** The code's dark modules as an SVG picture, for the window's preview; black on white with the quiet zone. */
export function qrPreviewSvg(matrix: readonly (readonly boolean[])[], quietZone: boolean) {
  const margin = quietZone ? QR_QUIET_MODULES : 0;
  const size = matrix.length + 2 * margin;
  const rects = qrRectangles(matrix)
    .map((rect) => `<rect x="${rect.x + margin}" y="${rect.y + margin}" width="${rect.width}" height="${rect.height}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** The stored settings made safe, or null when they are no QR settings at all (no text). */
export function normalizeQrSettings(input: unknown): QrCodeSettings | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<QrCodeSettings>;
  if (typeof raw.text !== "string" || !raw.text) return null;
  const errorCorrection = QR_ERROR_CORRECTIONS.includes(raw.errorCorrection as QrErrorCorrection) ? raw.errorCorrection as QrErrorCorrection : DEFAULT_QR_SETTINGS.errorCorrection;
  const style = QR_STYLES.includes(raw.style as QrStyle) ? raw.style as QrStyle : DEFAULT_QR_SETTINGS.style;
  return {
    text: raw.text.slice(0, QR_BYTE_CAPACITY.L),
    errorCorrection,
    quietZone: raw.quietZone !== false,
    style,
    codeHeight: clamp(raw.codeHeight, MIN_QR_HEIGHT, MAX_QR_HEIGHT, style === "code" ? DEFAULT_QR_CODE_HEIGHT : DEFAULT_QR_RELIEF),
    plateThickness: clamp(raw.plateThickness, MIN_QR_HEIGHT, MAX_QR_HEIGHT, DEFAULT_QR_PLATE_THICKNESS),
  };
}

/** Whether two settings are the same, for the shapes' comparison. */
export function qrSettingsEqual(a: QrCodeSettings | undefined, b: QrCodeSettings | undefined) {
  if (!a || !b) return !a && !b;
  return a.text === b.text && a.errorCorrection === b.errorCorrection && a.quietZone === b.quietZone && a.style === b.style && a.codeHeight === b.codeHeight && a.plateThickness === b.plateThickness;
}
