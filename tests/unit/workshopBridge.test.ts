import { describe, expect, it, vi } from "vitest";
import { buildWorkshopForm, parseWorkshopParams, pngBlobFromDataUrl, WorkshopClient, type WorkshopConfig } from "@/lib/workshopBridge";

const ORIGIN = "https://example.test";
const base: WorkshopConfig = { api: `${ORIGIN}/3dp-workshop`, slug: "spring", projectId: null, sessionId: "s1", mode: "edit", readonly: false };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("parseWorkshopParams", () => {
  it("is off without workshop=1", () => {
    expect(parseWorkshopParams("?editor=1", ORIGIN)).toBeNull();
    expect(parseWorkshopParams("", ORIGIN)).toBeNull();
  });

  it("reads every parameter", () => {
    const config = parseWorkshopParams("?workshop=1&api=https://example.test/3dp-workshop/&slug=spring&project_id=p1&session_id=s1&mode=remix&readonly=1", ORIGIN);
    expect(config).toEqual({ api: `${ORIGIN}/3dp-workshop`, slug: "spring", projectId: "p1", sessionId: "s1", mode: "remix", readonly: true });
  });

  it("accepts a relative api and defaults the rest", () => {
    const config = parseWorkshopParams("?workshop=1&api=/3dp-workshop", ORIGIN);
    expect(config).toMatchObject({ api: `${ORIGIN}/3dp-workshop`, slug: "", projectId: null, sessionId: null, mode: "edit", readonly: false });
  });

  it("falls back to the folder next to the editor's base path", () => {
    expect(parseWorkshopParams("?workshop=1", ORIGIN, "/3dp-workshop/editor")?.api).toBe(`${ORIGIN}/3dp-workshop`);
  });

  it("refuses an api on another origin", () => {
    expect(parseWorkshopParams("?workshop=1&api=https://evil.test/3dp-workshop", ORIGIN)).toBeNull();
  });
});

describe("multipart building", () => {
  it("has a project part with the .lyl type and a png thumbnail", async () => {
    const png = pngBlobFromDataUrl(`data:image/png;base64,${btoa("x".repeat(120))}`);
    expect(png?.type).toBe("image/png");
    const form = buildWorkshopForm(new Uint8Array([80, 75, 3, 4]), png);
    const project = form.get("project") as File;
    expect(project.type).toBe("application/vnd.layerling.project+zip");
    expect(project.name).toBe("design.lyl");
    expect(new Uint8Array(await project.arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]));
    expect((form.get("thumbnail") as File).type).toBe("image/png");
  });

  it("leaves the thumbnail out when there is none", () => {
    expect(buildWorkshopForm(new Uint8Array([1]), null).has("thumbnail")).toBe(false);
    expect(pngBlobFromDataUrl("data:image/jpeg;base64,AAAA")).toBeNull();
    expect(pngBlobFromDataUrl("")).toBeNull();
  });
});

describe("WorkshopClient", () => {
  it("loads a design with the cookies of the page", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const client = new WorkshopClient({ ...base, projectId: "p 1" }, { fetchImpl, parent: null, origin: ORIGIN });
    expect(await client.loadProject()).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchImpl).toHaveBeenCalledWith(`${base.api}/api/store/projects/p%201`, expect.objectContaining({ credentials: "same-origin" }));
    expect(await new WorkshopClient(base, { fetchImpl, parent: null, origin: ORIGIN }).loadProject()).toBeNull();
  });

  it("reports the server's error text", async () => {
    const fetchImpl = vi.fn(async () => json({ error: "forbidden" }, 403));
    const client = new WorkshopClient({ ...base, projectId: "p1" }, { fetchImpl, parent: null, origin: ORIGIN });
    await expect(client.loadProject()).rejects.toMatchObject({ message: "forbidden", status: 403 });
  });

  it("POSTs the first save of a new design, then PUTs, and tells the parent the new id", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "new1", versionTimestamp: 5 }));
    const parent = { postMessage: vi.fn() };
    const client = new WorkshopClient(base, { fetchImpl, parent, origin: ORIGIN });
    await client.save({ bytes: new Uint8Array([1]), thumbnail: null, title: "My design" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${base.api}/api/store/workshops/spring/projects?sessionId=s1&title=My+design`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(parent.postMessage).toHaveBeenCalledWith({ type: "3dp-workshop:project-id-updated", projectId: "new1" }, ORIGIN);
    expect(client.projectId).toBe("new1");

    await client.save({ bytes: new Uint8Array([2]), thumbnail: null, title: "My design" });
    const [putUrl, putInit] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(putUrl).toBe(`${base.api}/api/store/projects/new1`);
    expect(putInit.method).toBe("PUT");
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
  });

  it("remix: the first save is a POST with originalId, even though project_id is set", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "copy1" }));
    const client = new WorkshopClient({ ...base, mode: "remix", projectId: "orig" }, { fetchImpl, parent: null, origin: ORIGIN });
    await client.save({ bytes: new Uint8Array([1]), thumbnail: null, title: "" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${base.api}/api/store/workshops/spring/projects?sessionId=s1&originalId=orig`);
    expect(init.method).toBe("POST");
  });

  it("edit with project_id saves with PUT right away; a failed save throws", async () => {
    const fetchImpl = vi.fn(async () => json({ error: "too big" }, 413));
    const client = new WorkshopClient({ ...base, projectId: "p1" }, { fetchImpl, parent: null, origin: ORIGIN });
    await expect(client.save({ bytes: new Uint8Array([1]), thumbnail: null, title: "t" })).rejects.toMatchObject({ status: 413, message: "too big" });
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe("PUT");
  });

  it("answers a save request with an acknowledgement first, then the result", async () => {
    const parent = { postMessage: vi.fn() };
    const client = new WorkshopClient(base, { fetchImpl: vi.fn(), parent, origin: ORIGIN });
    let release: (value: { ok: boolean; saved: boolean }) => void = () => undefined;
    client.setSaveHandler(() => new Promise((resolve) => { release = resolve; }));
    const pending = client.handleMessage({ origin: ORIGIN, data: { type: "3dp-workshop:save-request", requestId: "r1" } });
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: "3dp-workshop:save-ack", requestId: "r1" }, ORIGIN);
    release({ ok: true, saved: true });
    await pending;
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: "3dp-workshop:save-result", requestId: "r1", ok: true, saved: true }, ORIGIN);
  });

  it("ignores other origins and other messages", async () => {
    const parent = { postMessage: vi.fn() };
    const client = new WorkshopClient(base, { fetchImpl: vi.fn(), parent, origin: ORIGIN });
    await client.handleMessage({ origin: "https://evil.test", data: { type: "3dp-workshop:save-request", requestId: "r" } });
    await client.handleMessage({ origin: ORIGIN, data: { type: "something-else" } });
    await client.handleMessage({ origin: ORIGIN, data: null });
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("reports ok:false when saving throws, and nothing saved when readonly or no editor yet", async () => {
    const parent = { postMessage: vi.fn() };
    const client = new WorkshopClient(base, { fetchImpl: vi.fn(), parent, origin: ORIGIN });
    await client.handleMessage({ origin: ORIGIN, data: { type: "3dp-workshop:save-request", requestId: "a" } });
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: "3dp-workshop:save-result", requestId: "a", ok: true, saved: false }, ORIGIN);
    client.setSaveHandler(async () => { throw new Error("boom"); });
    await client.handleMessage({ origin: ORIGIN, data: { type: "3dp-workshop:save-request", requestId: "b" } });
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: "3dp-workshop:save-result", requestId: "b", ok: false, saved: false }, ORIGIN);
    const readonly = new WorkshopClient({ ...base, readonly: true }, { fetchImpl: vi.fn(), parent, origin: ORIGIN });
    const handler = vi.fn(async () => ({ ok: true, saved: true }));
    readonly.setSaveHandler(handler);
    await readonly.handleMessage({ origin: ORIGIN, data: { type: "3dp-workshop:save-request", requestId: "c" } });
    expect(handler).not.toHaveBeenCalled();
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: "3dp-workshop:save-result", requestId: "c", ok: true, saved: false }, ORIGIN);
  });
});
