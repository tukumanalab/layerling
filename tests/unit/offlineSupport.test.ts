import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serviceWorkerCanRun } from "@/lib/offlineSupport";

describe("what layerling may promise about working offline (#571)", () => {
  it("needs the static export, a secure address and a browser that has service workers", () => {
    expect(serviceWorkerCanRun(true, true, true)).toBe(true);
    // The Docker image runs as a Node server: no service worker, even behind https.
    expect(serviceWorkerCanRun(false, true, true)).toBe(false);
    // A plain-http address such as a home server.
    expect(serviceWorkerCanRun(true, false, true)).toBe(false);
    expect(serviceWorkerCanRun(true, true, false)).toBe(false);
  });

  it("is what the install card, the offline tile and the registration all ask", () => {
    const root = join(process.cwd(), "apps", "web", "src");
    for (const file of ["components/InstallAppHint.tsx", "components/ServiceWorkerRegistration.tsx", "app/page.tsx"]) {
      expect(readFileSync(join(root, file), "utf8"), `${file} must ask lib/offlineSupport`).toMatch(/[oO]fflineAvailable/);
    }
  });
});
