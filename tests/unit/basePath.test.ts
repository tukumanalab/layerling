import { afterEach, describe, expect, it, vi } from "vitest";
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

/*
 * The guide is built into the same folder (build-guide.mjs reads LAYERLING_BASE_PATH), so the
 * links the program makes to it need the base path too - without it they point at the root of
 * the host and find nothing.
 */
describe("the links to the guide under a base path", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("start at the root when there is no base path", async () => {
    const { guideHref } = await import("@/lib/guideLinks");
    const { guideIndexUrl } = await import("@/lib/guideHelp");
    expect(guideHref("ja", "tablet")).toBe("/guide-ja/tablet-and-touch.html");
    expect(guideIndexUrl("ja")).toBe("/guide-ja/search-index.json");
  });

  it("start with the base path when the program is served from a folder", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/3dp/editor");
    vi.resetModules();
    const { guideHref } = await import("@/lib/guideLinks");
    const { guideIndexUrl } = await import("@/lib/guideHelp");
    expect(guideHref("ja")).toBe("/3dp/editor/guide-ja/index.html");
    expect(guideHref("ja", "tablet")).toBe("/3dp/editor/guide-ja/tablet-and-touch.html");
    expect(guideHref("en", undefined, "sectionView")).toBe("/3dp/editor/guide/view-and-workplane.html#looking-inside-the-section-view");
    expect(guideIndexUrl("ja")).toBe("/3dp/editor/guide-ja/search-index.json");
  });
});
