// Builds the Japanese typeface the text shape falls back to for kana and kanji.
//
// three.js ships M PLUS Rounded 1c (SIL Open Font License, OFL.txt beside it) as
// a typeface.json of 8,174 glyphs and 13.8 MB - too much to hand every visitor.
// This cuts it into two files: base.typeface.json keeps what most Japanese text
// needs (ASCII and Latin-1, the symbols, kana, Greek and Cyrillic of JIS X 0208
// rows 1-8, and the 2,965 level-1 kanji of rows 16-47) and level2.typeface.json
// the level-2 kanji of rows 48-84 (澤, 槇, 檜) the font has. Both go to
// apps/web/public/fonts/japanese/<hash>/, which is gitignored like the occt
// runtime, and the hash (also in version.txt, which next.config.ts reads) is of
// their content, so a browser cannot pair new code with an older cut. They are
// plain files, not chunks: textFonts.ts fetches them the first time a text needs
// them, and the service worker keeps them out of the install download.
// It runs before dev, build and export.
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The character set lives with the interface, which keeps fonts of one's own by the same rule.
const { commonJapaneseCharacters, level2JapaneseCharacters } = await import(pathToFileURL(join(root, "apps", "web", "src", "lib", "japaneseText.ts")).href);
const source = join(root, "node_modules", "three", "examples", "fonts", "MPLUSRounded1c", "MPLUSRounded1c-Regular.typeface.json.zip");
const outRoot = join(root, "apps", "web", "public", "fonts", "japanese");

/** The one file of a zip archive by name, read through the central directory (the local headers carry no sizes). */
function unzipEntry(archive, wanted) {
  const eocd = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a zip archive");
  const entries = archive.readUInt16LE(eocd + 10);
  let offset = archive.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index++) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error("Bad central directory");
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name === wanted) {
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = archive.subarray(start, start + compressedSize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`Unsupported zip compression ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${wanted} not in the archive`);
}

async function main() {
  const archive = await readFile(source);
  const full = JSON.parse(unzipEntry(archive, "MPLUSRounded1c-Regular.typeface.json").toString("utf8"));
  const cut = (characters, note) => {
    const glyphs = {};
    for (const char of characters) if (full.glyphs[char]) glyphs[char] = full.glyphs[char];
    return { glyphs, json: JSON.stringify({ ...full, glyphs, original_font_information: { ...full.original_font_information, note } }) };
  };
  const base = cut(commonJapaneseCharacters(), "Subset by scripts/build-japanese-typeface.mjs: Latin, JIS X 0208 rows 1-8 and 16-47");
  const level2Characters = level2JapaneseCharacters();
  const level2 = cut(level2Characters, "Subset by scripts/build-japanese-typeface.mjs: JIS X 0208 rows 48-84");
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
  console.log(`[japanese-typeface] base ${count(base)} glyphs, ${size(base.json)}; level2 ${count(level2)} glyphs, ${size(level2.json)} -> apps/web/public/fonts/japanese/${hash}/`);
  console.log(`[japanese-typeface] ${level2Characters.length - count(level2)} of ${level2Characters.length} level-2 kanji are not in the source font`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
