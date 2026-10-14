import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commonJapaneseCharacters, isJapaneseCharacter, level2JapaneseCharacters, textNeedsJapanese, textNeedsJapaneseLevel2 } from "@/lib/japaneseText";
import { JAPANESE_FONT, customFontRevision, japaneseLevel2Loaded, japaneseTypefaceLoaded, loadJapaneseLevel2, loadJapaneseTypeface, loadTextFonts, resetJapaneseTypefaceForTests, setJapaneseTypefaceFetcherForTests, textFont } from "@/lib/textFonts";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FontData } from "three/examples/jsm/loaders/FontLoader.js";

/*
 * Japanese text: the built-in faces have no kana and no kanji, so M PLUS Rounded 1c, cut down by
 * scripts/build-japanese-typeface.mjs, lends them to every face and is a face of its own.
 */
const fontRoot = fileURLToPath(new URL("../../apps/web/public/fonts/japanese/", import.meta.url));
const generated = existsSync(`${fontRoot}version.txt`);
const readTypeface = async (file: "base" | "level2") => JSON.parse(readFileSync(`${fontRoot}${readFileSync(`${fontRoot}version.txt`, "utf8").trim()}/${file}.typeface.json`, "utf8")) as FontData;

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

  it("has the level-2 kanji of rows 48-84 apart from the common ones", () => {
    const level2 = level2JapaneseCharacters();
    expect(level2.length).toBeGreaterThan(3000);
    for (const char of "澤槇檜") expect(level2.includes(char), char).toBe(true);
    expect(level2.some((char) => commonJapaneseCharacters().has(char))).toBe(false);
  });

  it("asks for the second file only for a character the first lacks", () => {
    expect(textNeedsJapaneseLevel2("石原")).toBe(false);
    expect(textNeedsJapaneseLevel2("Anna")).toBe(false);
    expect(textNeedsJapaneseLevel2("澤")).toBe(true);
    expect(textNeedsJapaneseLevel2("石澤")).toBe(true);
  });
});

describe.skipIf(!generated)("the Japanese face", () => {
  beforeEach(() => setJapaneseTypefaceFetcherForTests(readTypeface));
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

  it("lends the level-2 kanji to every face when the second file arrives", async () => {
    await loadTextFonts();
    const names = ["Multilanguage", "Sans", "Serif", "Script", "Monospace", "Rounded", JAPANESE_FONT];
    await loadJapaneseTypeface();
    for (const name of names) expect((textFont(name).data.glyphs as Record<string, unknown>)["澤"], name).toBeUndefined();
    const before = customFontRevision(undefined);
    await loadJapaneseLevel2();
    expect(japaneseLevel2Loaded()).toBe(true);
    expect(customFontRevision(undefined)).not.toBe(before);
    for (const name of names) {
      const glyphs = textFont(name).data.glyphs as Record<string, unknown>;
      for (const char of "澤槇檜") expect(glyphs[char], `${name}: ${char}`).toBeDefined();
      expect(textFont(name).generateShapes("澤", 10).length).toBeGreaterThan(0);
    }
  });

  it("tries a failed file again the next time", async () => {
    await loadTextFonts();
    let failures = 1;
    setJapaneseTypefaceFetcherForTests(async (file) => {
      if (file === "level2" && failures-- > 0) throw new Error("offline");
      return readTypeface(file);
    });
    await expect(loadJapaneseLevel2()).rejects.toThrow("offline");
    expect(japaneseLevel2Loaded()).toBe(false);
    await loadJapaneseLevel2();
    expect(japaneseLevel2Loaded()).toBe(true);
  });
});
