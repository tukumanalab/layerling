// Builds the Japanese typefaces the text shape offers and falls back to for kana and kanji.
//
// Two faces, both under the SIL Open Font License with the OFL.txt beside each file, both with
// every kanji of JIS X 0208: the 2,965 of level 1 and the 3,390 of level 2 (邉, 澤, 槇, 檜).
// - Zen Maru Gothic Regular (fonts/zen-maru-gothic), a rounded sans, which also lends kana and
//   kanji to every other face. M PLUS Rounded 1c, which three.js ships and
//   the face was cut from before, lacks 1,447 of the level-2 kanji, among them the 邉 of 渡邉.
// - Zen Kaku Gothic New Bold (fonts/zen-kaku-gothic-new), its square-cut sibling, in the bold
//   weight like the other built-in faces: a face of its own for a text that should look crisp
//   rather than soft.
// Each face is offered under the font's own name.
// Each font file is read with opentype.js and turned into the typeface format the way a font of
// one's own is (customFonts.ts), cut into two files: base keeps what most Japanese text needs
// (ASCII and Latin-1, the symbols, kana, Greek and Cyrillic of JIS X 0208 rows 1-8, and the
// level-1 kanji of rows 16-47) and level2 the level-2 kanji of rows 48-84. The rounded face is
// base.typeface.json and level2.typeface.json, the gothic one gothic-base.typeface.json and
// gothic-level2.typeface.json. All go to apps/web/public/fonts/japanese/<hash>/, which is
// gitignored like the occt runtime, and the hash (also in version.txt, which next.config.ts
// reads) is of their content, so a browser cannot pair new code with an older cut. They are
// plain files, not chunks: textFonts.ts fetches them the first time a text needs them, and the
// service worker keeps them out of the install download. It runs before dev, build and export.
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
/** The faces, by the prefix of their files: "" for base/level2, "gothic-" for gothic-base/gothic-level2. */
const SOURCES = {
  "": { file: join(root, "fonts", "zen-maru-gothic", "ZenMaruGothic-Regular.ttf"), fullName: "Zen Maru Gothic Regular", familyName: "Zen Maru Gothic" },
  "gothic-": { file: join(root, "fonts", "zen-kaku-gothic-new", "ZenKakuGothicNew-Bold.ttf"), fullName: "Zen Kaku Gothic New Bold", familyName: "Zen Kaku Gothic New" },
};
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

/** The two cuts of one font file: base and level2, each as glyphs and as the JSON that is written. */
async function cutFont({ file, fullName: defaultFullName, familyName: defaultFamilyName }) {
  const bytes = await readFile(file);
  const font = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const resolution = font.unitsPerEm || 1000;
  const byCharacter = glyphsByCharacter(font);
  const english = (record) => record?.en ?? (record ? Object.values(record)[0] : undefined);
  const fullName = english(font.names.fullName) ?? defaultFullName;
  const head = font.tables.head;
  const header = {
    familyName: english(font.names.fontFamily) ?? defaultFamilyName,
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
  return {
    fullName,
    base: cut(commonJapaneseCharacters(), "Latin, JIS X 0208 rows 1-8 and 16-47"),
    level2: cut(level2JapaneseCharacters(), "JIS X 0208 rows 48-84"),
  };
}

async function main() {
  const faces = [];
  for (const [prefix, source] of Object.entries(SOURCES)) faces.push({ prefix, ...(await cutFont(source)) });
  const digest = createHash("sha256");
  for (const face of faces) digest.update(face.base.json).update(face.level2.json);
  const hash = digest.digest("hex").slice(0, 12);
  // Other cuts go: the folders of earlier releases would only pile up.
  await mkdir(outRoot, { recursive: true });
  for (const entry of await readdir(outRoot)) {
    if (entry !== hash) await rm(join(outRoot, entry), { recursive: true, force: true });
  }
  const dest = join(outRoot, hash);
  await mkdir(dest, { recursive: true });
  const size = (json) => `${(json.length / 1024 / 1024).toFixed(2)} MB`;
  const count = (cutFont) => Object.keys(cutFont.glyphs).length;
  const level2Characters = level2JapaneseCharacters();
  for (const face of faces) {
    await writeFile(join(dest, `${face.prefix}base.typeface.json`), face.base.json);
    await writeFile(join(dest, `${face.prefix}level2.typeface.json`), face.level2.json);
    console.log(`[japanese-typeface] ${face.fullName}: ${face.prefix}base ${count(face.base)} glyphs, ${size(face.base.json)}; ${face.prefix}level2 ${count(face.level2)} glyphs, ${size(face.level2.json)} -> apps/web/public/fonts/japanese/${hash}/`);
    const missing = level2Characters.length - count(face.level2);
    if (missing > 0) console.log(`[japanese-typeface] ${face.fullName}: ${missing} of ${level2Characters.length} level-2 kanji are not in the source font`);
  }
  await writeFile(join(outRoot, "version.txt"), hash);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
