// Builds the Japanese typeface the text shape falls back to for kana and kanji.
//
// three.js ships M PLUS Rounded 1c (SIL Open Font License, OFL.txt beside it) as
// a typeface.json of 8,174 glyphs and 13.8 MB - too much to hand every visitor.
// This keeps what Japanese text needs: ASCII and Latin-1, the symbols, kana,
// Greek and Cyrillic of JIS X 0208 rows 1-8, and the 2,965 level-1 kanji of rows
// 16-47, and writes them to apps/web/src/generated/, which is gitignored like the
// occt runtime. textFonts.ts imports the file as a chunk of its own, fetched the
// first time a text needs one of these characters.
import { inflateRawSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The character set lives with the interface, which keeps fonts of one's own by the same rule.
const { commonJapaneseCharacters } = await import(pathToFileURL(join(root, "apps", "web", "src", "lib", "japaneseText.ts")).href);
const source = join(root, "node_modules", "three", "examples", "fonts", "MPLUSRounded1c", "MPLUSRounded1c-Regular.typeface.json.zip");
const outDir = join(root, "apps", "web", "src", "generated");
const outFile = join(outDir, "mplus-rounded-1c-ja.typeface.json");

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
  const keep = commonJapaneseCharacters();
  const glyphs = {};
  for (const char of keep) if (full.glyphs[char]) glyphs[char] = full.glyphs[char];
  const typeface = { ...full, glyphs, original_font_information: { ...full.original_font_information, note: "Subset by scripts/build-japanese-typeface.mjs: Latin, JIS X 0208 rows 1-8 and 16-47" } };
  await mkdir(outDir, { recursive: true });
  const json = JSON.stringify(typeface);
  await writeFile(outFile, json);
  console.log(`[japanese-typeface] ${Object.keys(glyphs).length} glyphs, ${(json.length / 1024 / 1024).toFixed(1)} MB -> ${outFile}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
