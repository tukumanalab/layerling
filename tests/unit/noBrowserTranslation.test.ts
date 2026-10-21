import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("the page is not translated by the browser", () => {
  const layout = readFileSync(path.resolve(__dirname, "../../apps/web/src/app/layout.tsx"), "utf8");

  it("tells browsers not to translate: the language is the program's own", () => {
    // Chrome read the page as English before the chosen language was in and turned "Hell" into "Hölle".
    expect(layout).toMatch(/<html[^>]*translate="no"/);
    expect(layout).toMatch(/google:\s*"notranslate"/);
  });
});
