/**
 * Workshop mode: the editor embedded in "3DP Workshop" (an iframe on the
 * same origin) keeps its designs on that service instead of in a file.
 *
 *   ?workshop=1&api=<origin+basePath>&slug=&project_id=&session_id=&mode=remix&readonly=1
 *
 * Everything the mode needs from the outside lives in this file: reading the
 * address, loading and saving over the service's store API (multipart, cookies of
 * the same origin) and the postMessage conversation with the page around the
 * editor. Without `workshop=1` none of it runs.
 */
import { BASE_PATH } from "@/lib/basePath";

export const WORKSHOP_PROJECT_MEDIA_TYPE = "application/vnd.layerling.project+zip";

export type WorkshopConfig = {
  /** Origin plus base path of the service, no trailing slash: "https://host/3dp-workshop". */
  api: string;
  slug: string;
  /** The design to open, if any. */
  projectId: string | null;
  sessionId: string | null;
  /** remix: the opened design is only a template; the first save creates a new one. */
  mode: "edit" | "remix";
  readonly: boolean;
};

export type WorkshopSaveResult = { id: string; versionTimestamp?: string | number };

export type WorkshopSaveHandlerResult = { ok: boolean; saved: boolean };
/** Saves the design if it changed; supplied by the editor. */
export type WorkshopSaveHandler = () => Promise<WorkshopSaveHandlerResult>;

export class WorkshopError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WorkshopError";
    this.status = status;
  }
}

/** The settings from a query string, or null when this is not workshop mode (or the api is another origin). */
export function parseWorkshopParams(search: string, origin: string, basePath = BASE_PATH): WorkshopConfig | null {
  const params = new URLSearchParams(search);
  if (params.get("workshop") !== "1") return null;
  const fallbackApi = `${origin}${basePath.replace(/\/editor$/, "") || "/3dp-workshop"}`;
  let api: URL;
  try {
    api = new URL(params.get("api") || fallbackApi, origin);
  } catch {
    return null;
  }
  // Cookies and the iframe both rely on one origin: anything else is refused.
  if (api.origin !== origin) return null;
  const clean = (value: string | null) => (value && value.trim() ? value.trim() : null);
  return {
    api: `${api.origin}${api.pathname.replace(/\/+$/, "")}`,
    slug: clean(params.get("slug")) ?? "",
    projectId: clean(params.get("project_id")),
    sessionId: clean(params.get("session_id")),
    mode: params.get("mode") === "remix" ? "remix" : "edit",
    readonly: params.get("readonly") === "1",
  };
}

/** The mode of the current page, read once. Always null on the server render. */
let cachedConfig: WorkshopConfig | null | undefined;
export function getWorkshopConfig(): WorkshopConfig | null {
  if (typeof window === "undefined") return null;
  if (cachedConfig === undefined) cachedConfig = parseWorkshopParams(window.location.search, window.location.origin);
  return cachedConfig;
}

/** A PNG data address as a Blob, or null if it is not one. */
export function pngBlobFromDataUrl(dataUrl: string | null | undefined): Blob | null {
  const prefix = "data:image/png;base64,";
  if (!dataUrl || !dataUrl.startsWith(prefix) || dataUrl.length <= 100) return null;
  try {
    const binary = atob(dataUrl.slice(prefix.length));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: "image/png" });
  } catch {
    return null;
  }
}

/** The multipart body of a save: `project` (.lyl) and, if there is one, `thumbnail` (PNG). */
export function buildWorkshopForm(bytes: Uint8Array, thumbnail: Blob | null): FormData {
  const form = new FormData();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  form.append("project", new Blob([buffer], { type: WORKSHOP_PROJECT_MEDIA_TYPE }), "design.lyl");
  if (thumbnail) form.append("thumbnail", thumbnail, "thumbnail.png");
  return form;
}

type WorkshopClientOptions = {
  fetchImpl?: typeof fetch;
  /** The page around the editor; defaults to window.parent. */
  parent?: { postMessage: (message: unknown, targetOrigin: string) => void } | null;
  origin?: string;
};

export class WorkshopClient {
  readonly config: WorkshopConfig;
  /** The id the next save writes to; null until the first POST of a new design. */
  private currentId: string | null;
  private saveHandler: WorkshopSaveHandler | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly fetchImpl: typeof fetch;
  private readonly parent: WorkshopClientOptions["parent"];
  private readonly origin: string;

  constructor(config: WorkshopConfig, options: WorkshopClientOptions = {}) {
    this.config = config;
    this.currentId = config.mode === "remix" ? null : config.projectId;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.origin = options.origin ?? (typeof location !== "undefined" ? location.origin : "");
    this.parent = options.parent !== undefined ? options.parent : typeof window !== "undefined" && window.parent !== window ? window.parent : null;
  }

  get projectId() {
    return this.currentId;
  }

  /** The bytes of `project_id`, or null when the address names none. */
  async loadProject(): Promise<Uint8Array | null> {
    const id = this.config.projectId;
    if (!id) return null;
    const response = await this.fetchImpl(`${this.config.api}/api/store/projects/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw await errorFromResponse(response);
    return new Uint8Array(await response.arrayBuffer());
  }

  /** Writes the design: a POST for a new one, a PUT after that. Saves never overlap. */
  save(input: { bytes: Uint8Array; thumbnail: Blob | null; title: string }): Promise<WorkshopSaveResult> {
    const run = () => this.saveNow(input);
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async saveNow({ bytes, thumbnail, title }: { bytes: Uint8Array; thumbnail: Blob | null; title: string }): Promise<WorkshopSaveResult> {
    const body = buildWorkshopForm(bytes, thumbnail);
    const creating = this.currentId === null;
    let response: Response;
    if (creating) {
      if (!this.config.slug) throw new WorkshopError("The address has no workshop (slug)", 400);
      const query = new URLSearchParams();
      if (this.config.sessionId) query.set("sessionId", this.config.sessionId);
      if (this.config.mode === "remix" && this.config.projectId) query.set("originalId", this.config.projectId);
      if (title) query.set("title", title);
      const suffix = query.toString() ? `?${query}` : "";
      response = await this.fetchImpl(`${this.config.api}/api/store/workshops/${encodeURIComponent(this.config.slug)}/projects${suffix}`, { method: "POST", body, credentials: "same-origin" });
    } else {
      response = await this.fetchImpl(`${this.config.api}/api/store/projects/${encodeURIComponent(this.currentId as string)}`, { method: "PUT", body, credentials: "same-origin" });
    }
    if (!response.ok) throw await errorFromResponse(response);
    const payload = await response.json().catch(() => ({})) as { id?: unknown; versionTimestamp?: string | number };
    const id = typeof payload.id === "string" && payload.id ? payload.id : this.currentId;
    if (!id) throw new WorkshopError("The server did not return a design id", response.status);
    if (creating) {
      this.currentId = id;
      this.post({ type: "3dp-workshop:project-id-updated", projectId: id });
    }
    return { id, versionTimestamp: payload.versionTimestamp };
  }

  setSaveHandler(handler: WorkshopSaveHandler | null) {
    this.saveHandler = handler;
  }

  private post(message: Record<string, unknown>) {
    try {
      this.parent?.postMessage(message, this.origin);
    } catch {
      // A page that went away cannot be told.
    }
  }

  /** Answers a message from the page around the editor. Only the editor's own origin is listened to. */
  async handleMessage(event: { origin: string; data: unknown }) {
    if (event.origin !== this.origin) return;
    const data = event.data as { type?: unknown; requestId?: unknown } | null;
    if (!data || typeof data !== "object" || data.type !== "3dp-workshop:save-request") return;
    const requestId = data.requestId;
    this.post({ type: "3dp-workshop:save-ack", requestId });
    let result: WorkshopSaveHandlerResult = { ok: true, saved: false };
    if (!this.config.readonly && this.saveHandler) {
      try {
        result = await this.saveHandler();
      } catch {
        result = { ok: false, saved: false };
      }
    }
    this.post({ type: "3dp-workshop:save-result", requestId, ok: result.ok, saved: result.saved });
  }

  /** Starts listening on a window; returns the way to stop. */
  attach(target: Pick<Window, "addEventListener" | "removeEventListener">) {
    const listener = (event: MessageEvent) => void this.handleMessage(event);
    target.addEventListener("message", listener);
    return () => target.removeEventListener("message", listener);
  }
}

async function errorFromResponse(response: Response) {
  let message = `HTTP ${response.status}`;
  try {
    const payload = await response.json() as { error?: unknown };
    if (typeof payload.error === "string" && payload.error) message = payload.error;
  } catch {
    // Not JSON: the status says enough.
  }
  return new WorkshopError(message, response.status);
}
