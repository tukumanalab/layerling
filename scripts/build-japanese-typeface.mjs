// Builds the Japanese typeface the text shape falls back to for kana and kanji.
//
// The source is Zen Kaku Gothic New Bold (SIL Open Font License, fonts/zen-kaku-gothic-new/OFL.txt
// beside it), a square-cut sans in the bold weight of the other built-in faces, with every kanji
// of JIS X 0208: the 2,965 of level 1 and the 3,390 of level 2 (邉, 澤, 槇, 檜). M PLUS Rounded 1c,
// which three.js ships and the face was cut from before, lacks 1,447 of the level-2 kanji, among
// them the 邉 of 渡邉; Zen Maru Gothic, its rounded sibling that came between, looked too soft
// and too thin for a sign. The font file is read with
// opentype.js and turned into the typeface format the way a font of one's own is (customFonts.ts),
// cut into two files: base.typeface.json keeps what most Japanese text needs (ASCII and Latin-1,
// the symbols, kana, Greek and Cyrillic of JIS X 0208 rows 1-8, and the level-1 kanji of rows
// 16-47) and level2.typeface.json the level-2 kanji of rows 48-84. What the font lacks of the
// base set - Zen Kaku Gothic New has no Greek, primes or daggers - is listed when it runs, and
// Sans lends those at run time as it does for every face. Both go to
// apps/web/public/fonts/japanese/<hash>/, which is gitignored like the occt runtime, and the hash
// (also in version.txt, which next.config.ts reads) is of their content, so a browser cannot pair
// new code with an older cut. They are plain files, not chunks: textFonts.ts fetches them the
// first time a text needs them, and the service worker keeps them out of the install download.
// It runs before dev, build and export.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The character set and the outline conversion live with the interface, which keeps fonts of one's own by the same rules.
register("./web-src-alias-hooks.mjs", import.meta.url);
const { commonJapaneseCharacters, level2JapaneseCharacters } = await import(pathToFileURL(join(root, "apps", "web", "src", "lib", "japaneseText.ts")).href);
const { contoursFromCommands, normalizeGlyphContours, outlineString } = await import(pathToFileURL(join(root, "apps", "web", "src", "lib", "customFonts.ts")).href);
const { parse } = await import("opentype.js");
const source = join(root, "fonts", "zen-kaku-gothic-new", "ZenKakuGothicNew-Bold.ttf");
const outRoot = join(root, "apps", "web", "public", "fonts", "japanese");

/*
 * JIS X 0208 symbols that Unicode has twice, and the font under the other code point only: the
 * wave dash and the minus a Japanese IME types as the full-width ～ and －, the dash, the double
 * bar, the full-width currency signs, the angstrom sign. They are drawn with the twin's glyph
 * (escaped: an editor would fold the two spellings of Å into one).
 */
const TWINS = { "\u2015": "\u2014", "\uff5e": "\u301c", "\u2225": "\u2016", "\uff0d": "\u2212", "\uff04": "$", "\uffe0": "\u00a2", "\uffe1": "\u00a3", "\u212b": "\u00c5" };

/** The font's glyph for each character it has, by the character; a twin's where only that exists. */
function glyphsByCharacter(font) {
  const byCharacter = new Map();
  for (let index = 0; index < font.glyphs.length; index += 1) {
    const glyph = font.glyphs.get(index);
    for (const code of glyph.unicodes ?? (glyph.unicode !== undefined ? [glyph.unicode] : [])) {
      const char = String.fromCodePoint(code);
      if (!byCharacter.has(char)) byCharacter.set(char, glyph);
    }
  }
  for (const [char, twin] of Object.entries(TWINS)) {
    if (!byCharacter.has(char) && byCharacter.has(twin)) byCharacter.set(char, byCharacter.get(twin));
  }
  return byCharacter;
}

/** A glyph in the typeface format: advance, horizontal bounds and the outline string FontLoader reads. */
function typefaceGlyph(glyph, resolution) {
  const contours = normalizeGlyphContours(contoursFromCommands(glyph.path.commands));
  const xs = contours.flatMap((contour) => [contour.start.x, ...contour.segments.map((segment) => segment.x)]);
  return {
    ha: Math.round(glyph.advanceWidth ?? resolution),
    x_min: Math.round(glyph.xMin ?? (xs.length ? Math.min(...xs) : 0)),
    x_max: Math.round(glyph.xMax ?? (xs.length ? Math.max(...xs) : 0)),
    o: outlineString(contours),
  };
}

async function main() {
  const bytes = await readFile(source);
  const font = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const resolution = font.unitsPerEm || 1000;
  const byCharacter = glyphsByCharacter(font);
  const english = (record) => record?.en ?? (record ? Object.values(record)[0] : undefined);
  const fullName = english(font.names.fullName) ?? "Zen Kaku Gothic New Bold";
  const head = font.tables.head;
  const header = {
    familyName: english(font.names.fontFamily) ?? "Zen Kaku Gothic New",
    ascender: font.ascender,
    descender: font.descender,
    underlinePosition: font.tables.post?.underlinePosition ?? -100,
    underlineThickness: font.tables.post?.underlineThickness ?? 50,
    boundingBox: head ? { xMin: head.xMin, yMin: head.yMin, xMax: head.xMax, yMax: head.yMax } : { xMin: 0, yMin: font.descender, xMax: resolution, yMax: font.ascender },
    resolution,
  };
  const cut = (characters, note) => {
    const glyphs = {};
    for (const char of characters) {
      const glyph = byCharacter.get(char);
      if (glyph) glyphs[char] = typefaceGlyph(glyph, resolution);
    }
    const information = { format: 0, fullName, license: english(font.names.license), note: `Subset by scripts/build-japanese-typeface.mjs: ${note}` };
    return { glyphs, json: JSON.stringify({ glyphs, ...header, original_font_information: information }) };
  };
  const base = cut(commonJapaneseCharacters(), "Latin, JIS X 0208 rows 1-8 and 16-47");
  const level2Characters = level2JapaneseCharacters();
  const level2 = cut(level2Characters, "JIS X 0208 rows 48-84");
  const hash = createHash("sha256").update(base.json).update(level2.json).digest("hex").slice(0, 12);
  // Other cuts go: the folders of earlier releases would only pile up.
  await mkdir(outRoot, { recursive: true });
  for (const entry of await readdir(outRoot)) {
    if (entry !== hash) await rm(join(outRoot, entry), { recursive: true, force: true });
  }
  const dest = join(outRoot, hash);
  await mkdir(dest, { recursive: true });
  await writeFile(join(dest, "base.typeface.json"), base.json);
  await writeFile(join(dest, "level2.typeface.json"), level2.json);
  await writeFile(join(outRoot, "version.txt"), hash);
  const size = (json) => `${(json.length / 1024 / 1024).toFixed(2)} MB`;
  const count = (cutFont) => Object.keys(cutFont.glyphs).length;
  console.log(`[japanese-typeface] ${fullName}: base ${count(base)} glyphs, ${size(base.json)}; level2 ${count(level2)} glyphs, ${size(level2.json)} -> apps/web/public/fonts/japanese/${hash}/`);
  const missingBase = [...commonJapaneseCharacters()].filter((char) => !base.glyphs[char]);
  if (missingBase.length > 0) console.log(`[japanese-typeface] ${missingBase.length} of the common characters are not in the source font (Sans lends them at run time): ${missingBase.join("")}`);
  const missing = level2Characters.length - count(level2);
  if (missing > 0) console.log(`[japanese-typeface] ${missing} of ${level2Characters.length} level-2 kanji are not in the source font`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
