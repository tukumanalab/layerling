/**
 * Where the program lives on its address. Empty when it is served at the root
 * (layerling.com, a home server), "/layerling" when a host puts it in a folder,
 * as GitHub Pages does with a project site. next.config.ts sets it from
 * LAYERLING_BASE_PATH at build time; files of the program that name their own
 * address with a leading "/" go through `withBasePath` so they hold from a folder too.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** A site path ("/occt/1.0") as the browser has to request it, with the base path in front. */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
