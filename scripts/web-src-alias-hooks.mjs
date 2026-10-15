// Node resolve hook for the "@/" alias of apps/web (tsconfig paths), so a build script can import
// the interface's TypeScript modules the way the app does. Registered by the script that needs it:
//   import { register } from "node:module"; register("./web-src-alias-hooks.mjs", import.meta.url);
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = join(webSrc, specifier.slice(2));
    const file = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((candidate) => existsSync(candidate) && !candidate.endsWith("/"));
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
