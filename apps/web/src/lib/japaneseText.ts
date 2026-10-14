/**
 * What Japanese text needs from a typeface. Plain data and functions with no imports: the
 * interface reads it, and so does scripts/build-japanese-typeface.mjs in Node, which cuts the
 * Japanese face down to these characters.
 */

/** The characters of JIS X 0208 rows `from` to `to`, by way of EUC-JP; empty where the platform cannot decode it. */
function jisRows(from: number, to: number): string[] {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder("euc-jp");
  } catch {
    return [];
  }
  const characters: string[] = [];
  for (let row = from; row <= to; row++) {
    for (let cell = 1; cell <= 94; cell++) {
      const char = decoder.decode(Uint8Array.from([0xa0 + row, 0xa0 + cell]));
      if (char && char !== "�") characters.push(char);
    }
  }
  return characters;
}

let common: Set<string> | null = null;

/**
 * The characters the Japanese face keeps, and the ones a font of one's own keeps first when it
 * has more than fit: ASCII and Latin-1, the symbols, kana, Greek and Cyrillic of JIS X 0208
 * rows 1-8, and the 2,965 level-1 kanji of rows 16-47.
 */
export function commonJapaneseCharacters(): ReadonlySet<string> {
  if (common) return common;
  const set = new Set<string>();
  for (let code = 0x20; code <= 0x7e; code++) set.add(String.fromCharCode(code));
  for (let code = 0xa0; code <= 0xff; code++) set.add(String.fromCharCode(code));
  for (const char of jisRows(1, 8)) set.add(char);
  for (const char of jisRows(16, 47)) set.add(char);
  common = set;
  return set;
}

/** Whether a character is one the built-in faces lack and the Japanese face has: kana, kanji, their punctuation, the full-width forms. */
export function isJapaneseCharacter(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x3000 && code <= 0x30ff) || (code >= 0x3400 && code <= 0x9fff) || (code >= 0xff01 && code <= 0xff9f);
}

/** Whether a text has a character the Japanese face is needed for. */
export function textNeedsJapanese(text: string): boolean {
  for (const char of text) if (isJapaneseCharacter(char)) return true;
  return false;
}
