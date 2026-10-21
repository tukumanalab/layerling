import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
// @ts-expect-error the tool list is a plain .mjs module
import { tools } from "../../scripts/layerling-mcp-tools.mjs";
import { editorHistoryEntry } from "@/lib/editorHistory";
import { guideSectionForShape } from "@/lib/guideLinks";
import { exportLylProject, importLylProject, type LylProjectDocumentV1 } from "@/lib/lylProject";
import { normalizeQrSettings } from "@/lib/qrCode";
import { libraryShapeAssets, makeShapeFromAsset, qrCodeAsset, toolbarShapeAssets } from "@/lib/shapeCatalog";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import { canonicalizeShape, workplaneShapesEqual } from "@/lib/workplaneShapes";
import type { WorkplaneShape } from "@/types/layerling";

const settings = normalizeQrSettings({ text: "https://layerling.com/?q=Grüße", errorCorrection: "Q", style: "raised", quietZone: false })!;

/** A body carrying QR settings; what carries them does not matter to the project file. */
function qrBody(id: string, qrCode = settings): WorkplaneShape {
  const box = makeShapeFromAsset(toolbarShapeAssets.find((asset) => asset.id === "box")!);
  return canonicalizeShape({ ...box, id, name: "QR code", qrCode });
}

async function exported(shapes: WorkplaneShape[]) {
  return exportLylProject({
    projectId: "qr",
    projectName: "QR",
    createdAt: 1_700_000_000_000,
    modifiedAt: 1_700_000_100_000,
    shapes,
    history: [editorHistoryEntry(shapes, [])],
    historyIndex: 0,
    assets: [],
    workspace: DEFAULT_WORKPLANE_WORKSPACE,
    snapGrid: DEFAULT_SNAP_GRID,
    placementElevation: 0,
  });
}

describe("QR code in a project (#553)", () => {
  it("keeps its settings through saving and loading", async () => {
    const code = qrBody("qr");
    const plain = canonicalizeShape({ ...qrBody("plain"), qrCode: undefined });
    const restored = await importLylProject(await exported([code, plain]));
    const byId = new Map(restored.shapes.map((shape) => [shape.id, shape]));
    expect(byId.get("qr")!.qrCode).toEqual(settings);
    expect(workplaneShapesEqual(byId.get("qr")!, code)).toBe(true);
    // A body without a code - as every body of an older project - loads without one.
    expect(byId.get("plain")!.qrCode).toBeUndefined();
    expect(workplaneShapesEqual(byId.get("plain")!, plain)).toBe(true);
  });

  it("refuses settings without a text", async () => {
    const bytes = await exported([qrBody("qr")]);
    const files = unzipSync(bytes);
    const document = JSON.parse(strFromU8(files["project.json"])) as LylProjectDocumentV1;
    document.states.forEach((state) => state.nodes.forEach((node) => { node.definition.qrCode = { text: "" }; }));
    files["project.json"] = strToU8(JSON.stringify(document));
    await expect(importLylProject(zipSync(files))).rejects.toThrow(/qrCode/);
  });

  it("tells shapes apart by their QR settings", () => {
    const code = qrBody("qr");
    expect(workplaneShapesEqual(code, { ...code, qrCode: { ...settings } })).toBe(true);
    expect(workplaneShapesEqual(code, { ...code, qrCode: { ...settings, text: "other" } })).toBe(false);
    expect(workplaneShapesEqual(code, { ...code, qrCode: { ...settings, quietZone: true } })).toBe(false);
    expect(workplaneShapesEqual(code, { ...code, qrCode: undefined })).toBe(false);
  });

  it("is in the library after the icon tag and its question mark opens its section", () => {
    const ids = libraryShapeAssets.map((asset) => asset.id);
    expect(ids.indexOf(qrCodeAsset.id)).toBe(ids.indexOf("iconTag") + 1);
    expect(guideSectionForShape(qrBody("qr"))).toBe("qrCode");
    expect(guideSectionForShape({ kind: "mesh", groupedShapes: [{}], groupOperation: "bundle", qrCode: settings })).toBe("qrCode");
  });
});

type Tool = { name: string; inputSchema: { properties: Record<string, { type?: string; enum?: string[]; minimum?: number; maximum?: number }>; required?: string[] } };

describe("layerling_create_qr_code", () => {
  const tool = (tools as Tool[]).find((entry) => entry.name === "layerling_create_qr_code")!;

  it("is in the tool list with the window's choices", () => {
    expect(tool).toBeDefined();
    expect(Object.keys(tool.inputSchema.properties)).toEqual(expect.arrayContaining(["text", "errorCorrection", "width", "height", "quietZone", "asHole", "style"]));
    expect(tool.inputSchema.required).toEqual(["text"]);
    expect(tool.inputSchema.properties.errorCorrection.enum).toEqual(["L", "M", "Q", "H"]);
    expect(tool.inputSchema.properties.width).toMatchObject({ minimum: 5, maximum: 500 });
  });
});
