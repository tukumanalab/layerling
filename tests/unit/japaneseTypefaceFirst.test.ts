import { describe, expect, it } from "vitest";
import { JAPANESE_FONT, japaneseTypefaceLoaded, loadJapaneseTypeface, textFont, textFontsLoaded } from "@/lib/textFonts";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * A Japanese interface fetches the Japanese face as soon as the editor opens, which can be before
 * the built-in faces are there. Its own file, so that nothing has loaded them yet.
 */
const generated = existsSync(fileURLToPath(new URL("../../apps/web/src/generated/mplus-rounded-1c-ja.typeface.json", import.meta.url)));

describe.skipIf(!generated)("the Japanese face fetched ahead of the built-in faces", () => {
  it("waits for them and lends them its characters", async () => {
    expect(textFontsLoaded()).toBe(false);
    await loadJapaneseTypeface();
    expect(textFontsLoaded()).toBe(true);
    expect(japaneseTypefaceLoaded()).toBe(true);
    for (const name of ["Multilanguage", "Sans", "Serif", JAPANESE_FONT]) {
      const glyphs = textFont(name).data.glyphs as Record<string, unknown>;
      for (const char of "名前") expect(glyphs[char], `${name}: ${char}`).toBeDefined();
    }
  });
});
