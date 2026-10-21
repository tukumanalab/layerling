import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createServerCustomShapeFolder,
  deleteServerCustomShapeFolder,
  listServerCustomShapes,
  moveServerCustomShape,
  readServerCustomShape,
  renameServerCustomShapeFolder,
  serverCustomShapeId,
} from "@/lib/customShapesServer";
import { sortMyShapeFolders } from "@/lib/myShapes";
import {
  canHoldSubfolder,
  folderChildren,
  folderDepth,
  folderDescendantIds,
  folderLabel,
  foldersInTreeOrder,
  folderPathName,
  joinFolderPath,
  parentFolderPath,
} from "@/lib/customShapeFolders";

type Call = { url: URL; method: string; headers: Record<string, string> };

/** Answers the store's requests from a table of folders, and records them. */
function stubStore(folders: Record<string, { projects?: Array<Record<string, unknown>>; folders?: string[] }>, status = 200) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    calls.push({ url, method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string> });
    if ((init?.method ?? "GET") !== "GET") return new Response("{}", { status });
    const path = url.searchParams.get("path") ?? "";
    const entry = folders[path] ?? { projects: [], folders: [] };
    return new Response(JSON.stringify({ enabled: true, projects: entry.projects ?? [], folders: (entry.folders ?? []).map((name) => ({ name })) }));
  }));
  return calls;
}

const shape = (fileName: string, updatedAt: number) => ({ fileName, name: fileName.replace(/\.lyl$/, ""), updatedAt, size: 1, revision: `r-${fileName}` });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("custom shape folders", () => {
  it("sorts folders by name", () => {
    const folders = [{ id: "b", name: "Brackets", createdAt: 2, parentId: null }, { id: "a", name: "Adapters", createdAt: 3, parentId: null }, { id: "c", name: "Clips", createdAt: 1, parentId: null }];
    expect(sortMyShapeFolders(folders).map((folder) => folder.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the old id for a server shape at the top and puts the folder into the others", () => {
    expect(serverCustomShapeId({ fileName: "Halter.lyl", folder: null })).toBe("server:Halter.lyl");
    expect(serverCustomShapeId({ fileName: "Halter.lyl", folder: "Brackets" })).toBe("server:Brackets/Halter.lyl");
  });

  it("walks the tree of folders three levels deep", () => {
    const tree = [
      { id: "m3", name: "M3", parentId: "brackets" },
      { id: "brackets", name: "Brackets", parentId: null },
      { id: "short", name: "Short", parentId: "m3" },
      { id: "adapters", name: "Adapters", parentId: null },
      { id: "m2", name: "M2", parentId: "brackets" },
    ];
    expect(folderChildren(tree, null).map((folder) => folder.id)).toEqual(["adapters", "brackets"]);
    expect(foldersInTreeOrder(tree).map((folder) => folder.id)).toEqual(["adapters", "brackets", "m2", "m3", "short"]);
    expect([folderDepth(tree, null), folderDepth(tree, "brackets"), folderDepth(tree, "short")]).toEqual([0, 1, 3]);
    expect(folderLabel(tree, "short")).toBe("Brackets / M3 / Short");
    expect(folderDescendantIds(tree, "brackets").sort()).toEqual(["brackets", "m2", "m3", "short"]);
    // The third level takes shapes, not folders.
    expect([canHoldSubfolder(tree, null), canHoldSubfolder(tree, "m3"), canHoldSubfolder(tree, "short")]).toEqual([true, true, false]);
  });

  it("survives a loop in broken folder data", () => {
    const loop = [{ id: "a", name: "A", parentId: "b" }, { id: "b", name: "B", parentId: "a" }];
    expect(folderLabel(loop, "a")).toBe("B / A");
    expect(folderDescendantIds(loop, "a").sort()).toEqual(["a", "b"]);
  });

  it("splits and joins server folder paths", () => {
    expect(joinFolderPath(null, "Brackets")).toBe("Brackets");
    expect(joinFolderPath("Brackets", "M3")).toBe("Brackets/M3");
    expect([parentFolderPath("Brackets/M3"), parentFolderPath("Brackets")]).toEqual(["Brackets", null]);
    expect(folderPathName("Brackets/M3")).toBe("M3");
  });

  it("lists nested server folders as paths, and stops below the third level", async () => {
    stubStore({
      "": { folders: ["Custom shapes"] },
      "Custom shapes": { folders: ["Brackets"] },
      "Custom shapes/Brackets": { folders: ["M3"], projects: [shape("Halter.lyl", 1)] },
      "Custom shapes/Brackets/M3": { folders: ["Short"] },
      "Custom shapes/Brackets/M3/Short": { folders: ["Too deep"], projects: [shape("Bolt.lyl", 2)] },
      "Custom shapes/Brackets/M3/Short/Too deep": { projects: [shape("Lost.lyl", 3)] },
    });
    const listed = await listServerCustomShapes();
    expect(listed?.folders).toEqual(["Brackets", "Brackets/M3", "Brackets/M3/Short"]);
    expect(listed?.shapes.map((entry) => [entry.fileName, entry.folder])).toEqual([["Halter.lyl", "Brackets"], ["Bolt.lyl", "Brackets/M3/Short"]]);
    expect(serverCustomShapeId(listed!.shapes[1])).toBe("server:Brackets/M3/Short/Bolt.lyl");
  });

  it("lists the shapes at the top and in each folder, oldest first", async () => {
    stubStore({
      "": { folders: ["Custom shapes"] },
      "Custom shapes": { projects: [shape("Top.lyl", 3)], folders: ["Clips", "Brackets"] },
      "Custom shapes/Brackets": { projects: [shape("Halter.lyl", 1)] },
      "Custom shapes/Clips": { projects: [shape("Clip.lyl", 2)] },
    });
    const listed = await listServerCustomShapes();
    expect(listed?.folders).toEqual(["Brackets", "Clips"]);
    expect(listed?.shapes.map((entry) => [entry.fileName, entry.folder])).toEqual([["Halter.lyl", "Brackets"], ["Clip.lyl", "Clips"], ["Top.lyl", null]]);
  });

  it("has neither shapes nor folders while the custom shapes folder is missing", async () => {
    stubStore({ "": { folders: ["Designs"] } });
    expect(await listServerCustomShapes()).toEqual({ shapes: [], folders: [] });
  });

  it("reads a shape from its folder", async () => {
    const calls = stubStore({});
    await readServerCustomShape({ fileName: "Halter.lyl", folder: "Brackets" });
    expect(calls[0].url.searchParams.get("path")).toBe("Custom shapes/Brackets");
    expect(calls[0].url.searchParams.get("fileName")).toBe("Halter.lyl");
  });

  it("moves a shape with the revision it was listed with, and out of a folder to the top", async () => {
    const calls = stubStore({});
    await moveServerCustomShape({ fileName: "Halter.lyl", folder: null, revision: "r1" }, "Brackets", "taken");
    await moveServerCustomShape({ fileName: "Halter.lyl", folder: "Brackets", revision: "r2" }, null, "taken");
    // Already there: nothing is sent.
    await moveServerCustomShape({ fileName: "Halter.lyl", folder: "Brackets", revision: "r2" }, "Brackets", "taken");
    expect(calls.map((call) => [call.method, call.url.searchParams.get("path"), call.url.searchParams.get("moveTo"), call.headers["If-Match"]])).toEqual([
      ["POST", "Custom shapes", "Custom shapes/Brackets", "\"r1\""],
      ["POST", "Custom shapes/Brackets", "Custom shapes", "\"r2\""],
    ]);
  });

  it("says a name is taken in the folder a shape moves into", async () => {
    stubStore({}, 409);
    await expect(moveServerCustomShape({ fileName: "Halter.lyl", folder: null, revision: "r1" }, "Brackets", "taken there")).rejects.toThrow("taken there");
  });

  it("creates, renames and deletes folders inside the custom shapes folder", async () => {
    const calls = stubStore({});
    await createServerCustomShapeFolder(" Brackets ", "taken");
    await createServerCustomShapeFolder("M3", "taken", "Brackets");
    await renameServerCustomShapeFolder("Brackets/M3", "M4", "taken");
    await renameServerCustomShapeFolder("Brackets", "Holders", "taken");
    await deleteServerCustomShapeFolder("Holders");
    const writes = calls.filter((call) => call.method !== "GET").map((call) => [call.method, Object.fromEntries(call.url.searchParams)]);
    expect(writes).toEqual([
      // The custom shapes folder first, in case it is not there yet.
      ["POST", { folder: "Custom shapes" }],
      ["POST", { path: "Custom shapes", folder: "Brackets" }],
      ["POST", { folder: "Custom shapes" }],
      ["POST", { path: "Custom shapes/Brackets", folder: "M3" }],
      ["POST", { path: "Custom shapes/Brackets/M3", renameTo: "M4" }],
      ["POST", { path: "Custom shapes/Brackets", renameTo: "Holders" }],
      ["DELETE", { path: "Custom shapes/Holders", deleteFolder: "1", recursive: "1" }],
    ]);
  });
});
