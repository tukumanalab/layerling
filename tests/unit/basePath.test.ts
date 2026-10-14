import { describe, expect, it } from "vitest";
import { BASE_PATH, withBasePath } from "@/lib/basePath";
import { precachePaths, serviceWorkerSource } from "../../scripts/generate-service-worker.mjs";

/*
 * A host that serves the export from a folder (GitHub Pages: /<repository>) sets
 * LAYERLING_BASE_PATH; every address the program names itself then starts with it.
 */
describe("the base path", () => {
  it("is empty by default, so addresses start at the root", () => {
    expect(BASE_PATH).toBe("");
    expect(withBasePath("/occt/1.0")).toBe("/occt/1.0");
  });

  it("goes in front of the stored paths of the offline copy", () => {
    const paths = precachePaths(["index.html", "_next/static/chunks/a.js", "sw.js", "store.php"], "/layerling");
    expect(paths).toEqual(["/layerling/", "/layerling/_next/static/chunks/a.js"]);
    expect(precachePaths(["index.html"], "")).toEqual(["/"]);
  });

  it("is known to the service worker, so its rules match the addresses it sees", () => {
    const source = serviceWorkerSource("v", ["/layerling/"], "/layerling");
    expect(source).toContain('const BASE = "/layerling";');
    expect(source).toContain('url.pathname.startsWith(BASE + "/api/")');
  });
});
