// A stand-in for "3DP Workshop" for trying workshop mode by hand:
//
//   LAYERLING_BASE_PATH=/3dp/editor npm run export
//   node tests/tools/workshop-mock-server.mjs [port]
//
//   /3dp/editor/...   the static export (apps/web/.next-export)
//   /3dp/parent.html  a page that frames the editor, like the real workshop page.
//                                    Query: the editor's parameters (project_id, mode, readonly, ...).
//   /3dp/api/store/   GET/POST/PUT of designs, kept in memory and in a temp folder
//   /__requests                      JSON list of every store request received (for checking)
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "apps", "web", ".next-export");
const port = Number(process.argv[2] ?? process.env.PORT ?? 8099);
const dataDir = mkdtempSync(join(tmpdir(), "workshop-mock-"));
const designs = new Map(); // id -> { slug, title, originalId, sessionId, versionTimestamp }
const requests = [];

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".xml": "application/xml",
};

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Minimal multipart/form-data: { name: { filename, type, data } }. */
function parseMultipart(body, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType ?? "");
  if (!boundary) return null;
  const delimiter = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  const parts = {};
  let position = body.indexOf(delimiter);
  while (position !== -1) {
    const start = position + delimiter.length;
    if (body.subarray(start, start + 2).toString() === "--") break;
    const next = body.indexOf(delimiter, start);
    if (next === -1) break;
    const part = body.subarray(start + 2, next - 2); // minus the CRLF after the delimiter and before the next
    const headerEnd = part.indexOf("\r\n\r\n");
    const headers = part.subarray(0, headerEnd).toString();
    const name = /name="([^"]*)"/.exec(headers)?.[1];
    if (name) {
      parts[name] = {
        filename: /filename="([^"]*)"/.exec(headers)?.[1],
        type: /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1],
        data: part.subarray(headerEnd + 4),
      };
    }
    position = next;
  }
  return parts;
}

const isZip = (data) => data.length > 4 && data[0] === 0x50 && data[1] === 0x4b;
const isPng = (data) => data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

function storeDesign(id, parts, meta) {
  if (!parts?.project || !isZip(parts.project.data)) return { status: 400, body: { error: "invalid project file" } };
  if (parts.thumbnail && !isPng(parts.thumbnail.data)) return { status: 400, body: { error: "invalid thumbnail" } };
  if (parts.project.data.length > 60 * 1024 * 1024) return { status: 413, body: { error: "too large" } };
  mkdirSync(join(dataDir, id), { recursive: true });
  writeFileSync(join(dataDir, id, "design.lyl"), parts.project.data);
  if (parts.thumbnail) writeFileSync(join(dataDir, id, "thumbnail.png"), parts.thumbnail.data);
  const versionTimestamp = Date.now();
  designs.set(id, { ...designs.get(id), ...meta, versionTimestamp });
  return { status: 200, body: { id, versionTimestamp } };
}

const parentPage = `<!doctype html><meta charset="utf-8"><title>mock workshop parent</title>
<style>body{margin:0;font:14px sans-serif}#bar{padding:6px;border-bottom:1px solid #ccc}iframe{width:100vw;height:calc(100vh - 40px);border:0}</style>
<div id="bar"><button id="save">save-request</button> <span id="log"></span></div>
<iframe id="editor" allow="clipboard-read; clipboard-write"></iframe>
<script>
  window.__messages = [];
  const params = new URLSearchParams(location.search);
  params.set("workshop", "1");
  if (!params.has("api")) params.set("api", location.origin + "/3dp");
  document.getElementById("editor").src = "/3dp/editor/?" + params;
  addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    window.__messages.push(event.data);
    document.getElementById("log").textContent = JSON.stringify(event.data);
  });
  window.requestSave = (requestId = "req-" + Date.now()) => {
    document.getElementById("editor").contentWindow.postMessage({ type: "3dp-workshop:save-request", requestId }, location.origin);
    return requestId;
  };
  document.getElementById("save").onclick = () => window.requestSave();
</script>`;

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = decodeURIComponent(url.pathname);
    if (path === "/__requests") return send(res, 200, requests);
    if (path === "/__designs") return send(res, 200, [...designs].map(([id, meta]) => ({ id, ...meta })));
    if (path === "/3dp/parent.html") return send(res, 200, parentPage, types[".html"]);

    const api = "/3dp/api/store/";
    if (path.startsWith(api)) {
      const rest = path.slice(api.length);
      const body = req.method === "GET" ? Buffer.alloc(0) : await readBody(req);
      const parts = req.method === "GET" ? null : parseMultipart(body, req.headers["content-type"]);
      requests.push({
        method: req.method, path, query: Object.fromEntries(url.searchParams), cookie: req.headers.cookie ?? null,
        parts: parts ? Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, { filename: part.filename, type: part.type, bytes: part.data.length, zip: isZip(part.data), png: isPng(part.data) }])) : null,
      });
      let match = /^workshops\/([^/]+)\/projects$/.exec(rest);
      if (match && req.method === "POST") {
        const id = randomUUID();
        const result = storeDesign(id, parts, { slug: match[1], title: url.searchParams.get("title"), originalId: url.searchParams.get("originalId"), sessionId: url.searchParams.get("sessionId") });
        return send(res, result.status, result.body);
      }
      match = /^projects\/([^/]+)(\/thumbnail)?$/.exec(rest);
      if (match) {
        const id = match[1];
        if (!designs.has(id) && !existsSync(join(dataDir, id))) return send(res, 404, { error: "not found" });
        if (req.method === "GET") {
          const file = join(dataDir, id, match[2] ? "thumbnail.png" : "design.lyl");
          if (!existsSync(file)) return send(res, 404, { error: "not found" });
          return send(res, 200, readFileSync(file), match[2] ? "image/png" : "application/vnd.layerling.project+zip");
        }
        if (req.method === "PUT") {
          const result = storeDesign(id, parts, {});
          return send(res, result.status, result.body);
        }
      }
      return send(res, 404, { error: "not found" });
    }

    const editor = "/3dp/editor";
    if (path === editor) {
      res.writeHead(301, { location: `${editor}/${url.search}` });
      return res.end();
    }
    if (path.startsWith(`${editor}/`)) {
      let file = normalize(join(root, path.slice(editor.length)));
      if (!file.startsWith(root)) return send(res, 403, "forbidden", "text/plain");
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
      if (!existsSync(file)) return send(res, 404, "not found", "text/plain");
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      return res.end(readFileSync(file));
    }
    send(res, 404, "not found", "text/plain");
  } catch (error) {
    send(res, 500, { error: String(error) });
  }
}).listen(port, () => {
  console.log(`workshop mock on http://localhost:${port}/3dp/parent.html  (editor: /3dp/editor/, data: ${dataDir})`);
});
