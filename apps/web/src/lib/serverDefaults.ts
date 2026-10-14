import { APP_THEME_OPTIONS, type AppThemePreference } from "@/lib/appTheme";
import { withBasePath } from "@/lib/basePath";

/**
 * What the server a copy of layerling runs on suggests for people who have not chosen yet. The
 * Node build answers on this route from its environment (`LAYERLING_DEFAULT_THEME`); an
 * installation served as plain files has no server to ask, so it never does.
 */
export const SERVER_DEFAULTS_ENDPOINT = withBasePath("/api/server-defaults");
export const DEFAULT_THEME_ENV = "LAYERLING_DEFAULT_THEME";

export type ServerDefaults = { theme: AppThemePreference | null };

/** The theme an operator wrote in the setting, or null when it is empty or not one of ours. */
export function parseDefaultTheme(value: unknown): AppThemePreference | null {
  if (typeof value !== "string") return null;
  const wanted = value.trim().toLowerCase();
  return APP_THEME_OPTIONS.find((option) => option.value === wanted)?.value ?? null;
}

/** The answer of the route: what the environment holds today. */
export function serverDefaultsFromEnvironment(environment: Record<string, string | undefined>): ServerDefaults {
  return { theme: parseDefaultTheme(environment[DEFAULT_THEME_ENV]) };
}

/**
 * Asks the server for its defaults. Any failure - no route on static hosting, an offline server,
 * an answer that is not ours - is simply "no suggestion".
 */
export async function fetchServerDefaultTheme(
  fetchImpl: typeof fetch = fetch,
  endpoint: string = SERVER_DEFAULTS_ENDPOINT,
): Promise<AppThemePreference | null> {
  try {
    // A POST, because that is what makes the Node build answer it on every call (see the route).
    const response = await fetchImpl(endpoint, { method: "POST", cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { theme?: unknown } | null;
    return parseDefaultTheme(body?.theme);
  } catch {
    return null;
  }
}
