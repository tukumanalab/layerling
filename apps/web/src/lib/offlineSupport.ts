import { useEffect, useState } from "react";

/**
 * Whether layerling can really work offline here (#571). The service worker that keeps it on the computer is
 * written only for the static export (scripts/generate-service-worker.mjs) and registered only there
 * (ServiceWorkerRegistration), and browsers allow one only on https or localhost. The Docker image runs as a
 * Node server, so it never has one, even behind https. Anything that promises "works without internet" - the
 * install card, the "Works offline" tile of the start page - asks here first.
 */

/** True in the static export, the only build that registers a service worker. Fixed when the page is built. */
export const BUILD_HAS_SERVICE_WORKER = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

export function serviceWorkerCanRun(staticExport: boolean, secureContext: boolean, browserSupports: boolean): boolean {
  return staticExport && secureContext && browserSupports;
}

/**
 * For a component: what the page was built for until it is mounted, then what this address and browser allow.
 * Starting from the build setting keeps the server-rendered page and the first client render the same.
 */
export function useOfflineAvailable(): boolean {
  const [available, setAvailable] = useState(BUILD_HAS_SERVICE_WORKER);
  useEffect(() => {
    setAvailable(offlineAvailable());
  }, []);
  return available;
}

/** In the browser: the build has a service worker, and this address and this browser allow it. */
export function offlineAvailable(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return serviceWorkerCanRun(BUILD_HAS_SERVICE_WORKER, window.isSecureContext, "serviceWorker" in navigator);
}
