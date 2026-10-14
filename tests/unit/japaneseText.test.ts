import { afterEach, describe, expect, it } from "vitest";
import { commonJapaneseCharacters, isJapaneseCharacter, textNeedsJapanese } from "@/lib/japaneseText";
import { JAPANESE_FONT, customFontRevision, japaneseTypefaceLoaded, loadJapaneseTypeface, loadTextFonts, resetJapaneseTypefaceForTests, textFont } from "@/lib/textFonts";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * Japanese text: the built-in faces have no kana and no kanji, so M PLUS Rounded 1c, cut down by
 * scripts/build-japanese-typeface.mjs, lends them to every face and is a face of its own.
 */
const generated = existsSync(fileURLToPath(new URL("../../apps/web/src/generated/mplus-rounded-1c-ja.typeface.json", import.meta.url)));

describe("what Japanese text needs", () => {
  it("knows kana, kanji, their punctuation and the full-width forms", () => {
    for (const char of "あアー名前、。！Ａ０") expect(isJapaneseCharacter(char), char).toBe(true);
    for (const char of "Aä€Я?") expect(isJapaneseCharacter(char), char).toBe(false);
    expect(textNeedsJapanese("Anna")).toBe(false);
    expect(textNeedsJapanese("太郎")).toBe(true);
  });

  it("keeps Latin, kana and the level-1 kanji, among them the common ones late in the block", () => {
    const common = commonJapaneseCharacters();
    for (const char of "Aé あアー、。名前太郎花子高鈴藤渡辺") expect(common.has(char), char).toBe(true);
    expect(common.size).toBeGreaterThan(3500);
  });
});

describe.skipIf(!generated)("the Japanese face", () => {
  afterEach(() => resetJapaneseTypefaceForTests());

  it("is fetched on demand and lends kana and kanji to every face", async () => {
    await loadTextFonts();
    expect(japaneseTypefaceLoaded()).toBe(false);
    const before = customFontRevision(undefined);
    const sans = textFont("Sans");
    expect((sans.data.glyphs as Record<string, unknown>)["名"]).toBeUndefined();
    // Chosen before it is here: Multilanguage meanwhile.
    expect(textFont(JAPANESE_FONT)).toBe(textFont("Multilanguage"));
    await loadJapaneseTypeface();
    expect(japaneseTypefaceLoaded()).toBe(true);
    expect(customFontRevision(undefined)).not.toBe(before);
    expect(textFont(JAPANESE_FONT)).not.toBe(textFont("Multilanguage"));
    for (const name of ["Multilanguage", "Sans", "Serif", "Script", "Monospace", "Rounded", JAPANESE_FONT]) {
      const glyphs = textFont(name).data.glyphs as Record<string, unknown>;
      for (const char of "名前太郎ひらがなカタカナ高鈴") expect(glyphs[char], `${name}: ${char}`).toBeDefined();
      expect(textFont(name).generateShapes("名", 10).length).toBeGreaterThan(0);
    }
    // The Japanese face has Greek and Cyrillic from Sans like the others.
    expect((textFont(JAPANESE_FONT).data.glyphs as Record<string, unknown>)["Я"]).toBeDefined();
  });
});
