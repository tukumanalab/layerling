import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commonJapaneseCharacters, isJapaneseCharacter, level2JapaneseCharacters, textNeedsJapanese, textNeedsJapaneseLevel2 } from "@/lib/japaneseText";
import { JAPANESE_FONT, builtInFontName, customFontRevision, japaneseLevel2Loaded, japaneseTypefaceLoaded, loadJapaneseLevel2, loadJapaneseTypeface, loadTextFonts, resetJapaneseTypefaceForTests, setJapaneseTypefaceFetcherForTests, textFont } from "@/lib/textFonts";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FontData } from "three/examples/jsm/loaders/FontLoader.js";

/*
 * Japanese text: the built-in faces have no kana and no kanji, so Zen Kaku Gothic New (bold), cut
 * down by scripts/build-japanese-typeface.mjs, lends them to every face and is a face of its own.
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
      for (const char of "澤槇檜邉") expect(glyphs[char], `${name}: ${char}`).toBeDefined();
      expect(textFont(name).generateShapes("澤", 10).length).toBeGreaterThan(0);
    }
  });

  it("has every level-2 kanji, 邉 among them, and the letters a kanji is made of", async () => {
    // M PLUS Rounded 1c lacked 1,447 of them, the 邉 of 渡邉 included; Zen Kaku Gothic New has them all.
    const level2 = await readTypeface("level2");
    const glyphs = level2.glyphs as Record<string, { o?: string }>;
    expect(Object.keys(glyphs).length).toBe(level2JapaneseCharacters().length);
    for (const char of "邉") expect(glyphs[char]?.o?.length ?? 0).toBeGreaterThan(0);
    const base = await readTypeface("base");
    // Zen Kaku Gothic New has no Greek, primes or daggers; Sans lends those (see below). Everything else is here.
    const missing = [...commonJapaneseCharacters()].filter((char) => !(base.glyphs as Record<string, unknown>)[char]);
    expect(missing.every((char) => /[\u0370-\u03ff\u2032\u2033\u2020\u2021]/.test(char)), missing.join("")).toBe(true);
    expect(Object.keys(base.glyphs).length + missing.length).toBe(commonJapaneseCharacters().size);
    // Zen Kaku Gothic New's own units, so the glyphs are shared with the other faces rather than scaled copies.
    expect(base.resolution).toBe(1000);
    await loadTextFonts();
    await loadJapaneseTypeface();
    await loadJapaneseLevel2();
    expect(textFont("Sans").generateShapes("渡邉", 10).length).toBeGreaterThan(0);
  });

  it("goes by the font's name, bold like the other faces, and still answers to the names it had before", async () => {
    expect(JAPANESE_FONT).toBe("Zen Kaku Gothic New");
    const base = await readTypeface("base");
    expect(base.original_font_information?.fullName).toBe("Zen Kaku Gothic New Bold");
    for (const old of ["Japanese", "Japanese Gothic", "Zen Maru Gothic"]) expect(builtInFontName(old), old).toBe(JAPANESE_FONT);
    expect(builtInFontName("Sans")).toBe("Sans");
    expect(builtInFontName(undefined)).toBeUndefined();
    await loadTextFonts();
    await loadJapaneseTypeface();
    expect(textFont("Japanese")).toBe(textFont(JAPANESE_FONT));
    expect(textFont("Zen Maru Gothic")).toBe(textFont(JAPANESE_FONT));
    // The Greek, primes and daggers the font lacks come from Sans; the Cyrillic is its own.
    const glyphs = textFont(JAPANESE_FONT).data.glyphs as Record<string, unknown>;
    for (const char of "ΩαЯ′†") expect(glyphs[char], char).toBeDefined();
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
