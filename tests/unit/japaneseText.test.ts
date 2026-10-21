import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commonJapaneseCharacters, isJapaneseCharacter, level2JapaneseCharacters, textNeedsJapanese, textNeedsJapaneseLevel2 } from "@/lib/japaneseText";
import { JAPANESE_FONT, JAPANESE_GOTHIC_FONT, builtInFontName, customFontRevision, ensureJapaneseGlyphs, japaneseGothicLevel2Loaded, japaneseGothicLoaded, japaneseLevel2Loaded, japaneseTypefaceLoaded, loadJapaneseGothic, loadJapaneseGothicLevel2, loadJapaneseLevel2, loadJapaneseTypeface, loadTextFonts, resetJapaneseTypefaceForTests, setJapaneseTypefaceFetcherForTests, textFont } from "@/lib/textFonts";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FontData } from "three/examples/jsm/loaders/FontLoader.js";

/*
 * Japanese text: the built-in faces have no kana and no kanji, so Zen Maru Gothic, cut down by
 * scripts/build-japanese-typeface.mjs, lends them to every face and is a face of its own. Zen Kaku
 * Gothic New, cut the same way, is the Japanese Gothic face: crisp where the other is soft.
 */
const fontRoot = fileURLToPath(new URL("../../apps/web/public/fonts/japanese/", import.meta.url));
const generated = existsSync(`${fontRoot}version.txt`);
const readTypeface = async (file: "base" | "level2" | "gothic-base" | "gothic-level2") => JSON.parse(readFileSync(`${fontRoot}${readFileSync(`${fontRoot}version.txt`, "utf8").trim()}/${file}.typeface.json`, "utf8")) as FontData;

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
    // M PLUS Rounded 1c lacked 1,447 of them, the 邉 of 渡邉 included; Zen Maru Gothic has them all.
    const level2 = await readTypeface("level2");
    const glyphs = level2.glyphs as Record<string, { o?: string }>;
    expect(Object.keys(glyphs).length).toBe(level2JapaneseCharacters().length);
    for (const char of "邉") expect(glyphs[char]?.o?.length ?? 0).toBeGreaterThan(0);
    const base = await readTypeface("base");
    expect(Object.keys(base.glyphs).length).toBe(commonJapaneseCharacters().size);
    // Zen Maru Gothic's own units, so the glyphs are shared with the other faces rather than scaled copies.
    expect(base.resolution).toBe(1000);
    await loadTextFonts();
    await loadJapaneseTypeface();
    await loadJapaneseLevel2();
    expect(textFont("Sans").generateShapes("渡邉", 10).length).toBeGreaterThan(0);
  });

  it("has a gothic face of its own that lends nothing to the others", async () => {
    await loadTextFonts();
    await loadJapaneseTypeface();
    expect(japaneseGothicLoaded()).toBe(false);
    // Chosen before it is here: the rounded face meanwhile.
    expect(textFont(JAPANESE_GOTHIC_FONT)).toBe(textFont(JAPANESE_FONT));
    const before = customFontRevision(undefined);
    await loadJapaneseGothic();
    expect(japaneseGothicLoaded()).toBe(true);
    expect(customFontRevision(undefined)).not.toBe(before);
    const gothic = textFont(JAPANESE_GOTHIC_FONT);
    expect(gothic).not.toBe(textFont(JAPANESE_FONT));
    expect(gothic).not.toBe(textFont("Multilanguage"));
    const glyphs = gothic.data.glyphs as Record<string, { o?: string }>;
    const rounded = textFont(JAPANESE_FONT).data.glyphs as Record<string, { o?: string }>;
    for (const char of "名前太郎ひらがなカタカナ高鈴渡") {
      expect(glyphs[char]?.o?.length ?? 0, char).toBeGreaterThan(0);
      expect(glyphs[char]?.o, `${char} drawn the same as the rounded face`).not.toBe(rounded[char]?.o);
    }
    expect(gothic.generateShapes("渡辺", 10).length).toBeGreaterThan(0);
    // The Greek and Cyrillic Zen Kaku Gothic New lacks come from Sans; a level-2 kanji waits for the second file.
    expect(glyphs["Я"]).toBeDefined();
    expect(glyphs["Ω"]).toBeDefined();
    expect(glyphs["邉"]).toBeUndefined();
    expect(japaneseGothicLevel2Loaded()).toBe(false);
    await loadJapaneseGothicLevel2();
    expect(japaneseGothicLevel2Loaded()).toBe(true);
    for (const char of "澤槇檜邉") expect(glyphs[char]?.o?.length ?? 0, char).toBeGreaterThan(0);
    expect(gothic.generateShapes("渡邉", 10).length).toBeGreaterThan(0);
    expect(glyphs["邉"]?.o).not.toBe(rounded["邉"]?.o);
  });

  it("goes by the fonts' names, and still answers to the names the faces had before", async () => {
    expect(JAPANESE_FONT).toBe("Zen Maru Gothic");
    expect(JAPANESE_GOTHIC_FONT).toBe("Zen Kaku Gothic New");
    expect(builtInFontName("Japanese")).toBe(JAPANESE_FONT);
    expect(builtInFontName("Japanese Gothic")).toBe(JAPANESE_GOTHIC_FONT);
    expect(builtInFontName("Sans")).toBe("Sans");
    expect(builtInFontName(undefined)).toBeUndefined();
    await loadTextFonts();
    await loadJapaneseTypeface();
    await loadJapaneseGothic();
    expect(textFont("Japanese")).toBe(textFont(JAPANESE_FONT));
    expect(textFont("Japanese Gothic")).toBe(textFont(JAPANESE_GOTHIC_FONT));
  });

  it("is bold, like the other built-in faces", async () => {
    const gothic = await readTypeface("gothic-base");
    expect(gothic.original_font_information?.fullName).toBe("Zen Kaku Gothic New Bold");
  });

  it("fetches the gothic files for a text set in that face, and the rounded ones for any other", async () => {
    await loadTextFonts();
    const fetched: string[] = [];
    setJapaneseTypefaceFetcherForTests(async (file) => {
      fetched.push(file);
      return readTypeface(file);
    });
    ensureJapaneseGlyphs("渡邉", JAPANESE_GOTHIC_FONT);
    expect(fetched).toEqual(["gothic-base"]);
    await loadJapaneseGothicLevel2();
    expect(fetched).toEqual(["gothic-base", "gothic-level2"]);
    expect(japaneseTypefaceLoaded()).toBe(false);
    ensureJapaneseGlyphs("渡邉", "Sans");
    await loadJapaneseLevel2();
    expect(fetched).toEqual(["gothic-base", "gothic-level2", "base", "level2"]);
    ensureJapaneseGlyphs("Anna", JAPANESE_GOTHIC_FONT);
    expect(fetched.length).toBe(4);
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
