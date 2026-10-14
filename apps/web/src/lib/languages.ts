/**
 * The languages layerling speaks, and everything about each one that is not a translated
 * sentence: how it names itself, how it writes numbers, where its community meets, what its
 * guide pages call things. One entry per language is all the code has to know; the sentences
 * themselves live in `messages.<code>.ts` and the guide in `docs/guide/<code>/`.
 *
 * Plain data on purpose, with no imports: the interface reaches it, and so does the guide builder
 * (scripts/build-guide.mjs) and the translation status script, which read it as a module in Node.
 * Keep it to what Node can run as it stands: types and constants, nothing else.
 *
 * To add a language, see docs/TRANSLATING.md.
 */
export const LANGUAGES = ["en", "de", "ja"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

/** The words of a guide page that are not chapter text, in the language of the page. */
export type GuideStrings = {
  site: string;
  home: string;
  openEditor: string;
  backToEditor: string;
  editorElsewhere: string;
  chapters: string;
  onThisPage: string;
  previous: string;
  next: string;
  overviewLead: string;
  sourceNote: string;
  forum: string;
  /** Said at the top of a chapter that is not translated yet and shows its English text. */
  notTranslated: string;
  /** The label of the language menu on a guide page. */
  languageMenu: string;
  /** The search box at the top of a guide page: what it is called and what it says when nothing matches. */
  search: string;
  searchNothing: string;
};

export type LanguageInfo = {
  /** The language's own name, as the language list shows it. */
  name: string;
  /** The tag for the `lang` attribute and for hreflang. */
  htmlLang: string;
  /** The locale numbers are written in (separators, grouping). */
  numberLocale: string;
  /** Opening and closing quotation marks. */
  quotes: readonly [string, string];
  /** Folder of its guide pages under the site root. */
  guideDir: string;
  /** Where its community meets: the forum or the project's discussions. */
  communityUrl: string;
  /** The README that explains the project in this language, as a file name in the repository. */
  readme: string;
  /** The anchor of the Windows quickstart section in that README. */
  quickstartAnchor: string;
  /** The built-in labels of the legal links in the footer. */
  legal: { imprint: string; privacy: string };
  /**
   * Whether people write "ae", "oe" and "ue" for the letters ä, ö and ü, as German does when the
   * keyboard has none; the guide search then finds one for the other.
   */
  asciiUmlauts: boolean;
  /** Names of keys and mouse actions where the language does not use the English ones. */
  keyNames: Readonly<Record<string, string>>;
  /**
   * Whether the language has every sentence of the interface. A complete language is held to it by
   * a test; any other shows the English sentence where its own is missing.
   */
  complete: boolean;
  guide: GuideStrings;
};

const GITHUB_DISCUSSIONS = "https://github.com/henmedia/layerling/discussions";
const DRUCKTIPPS_FORUM = "https://forum.drucktipps3d.de/forum/board/127-layerling/";

export const LANGUAGE_INFO: Readonly<Record<Language, LanguageInfo>> = {
  en: {
    name: "English",
    htmlLang: "en",
    numberLocale: "en-US",
    quotes: ["“", "”"],
    guideDir: "guide",
    communityUrl: GITHUB_DISCUSSIONS,
    readme: "README.md",
    quickstartAnchor: "windows-quickstart",
    legal: { imprint: "Imprint", privacy: "Privacy Policy" },
    keyNames: { RightClick: "Right click" },
    asciiUmlauts: false,
    complete: true,
    guide: {
      site: "layerling user guide",
      home: "User guide",
      openEditor: "Open the editor",
      backToEditor: "Back to the editor",
      editorElsewhere: "The editor is already open in another tab - just switch to it.",
      chapters: "Chapters",
      onThisPage: "On this page",
      previous: "Previous chapter",
      next: "Next chapter",
      overviewLead: "Everything layerling can do, step by step. The pictures are taken from the running program and are renewed with every version.",
      sourceNote: "This guide grows with the program. If something is missing or wrong, tell us in the",
      forum: "discussions",
      notTranslated: "This chapter is not translated into your language yet. The English text follows.",
      languageMenu: "Language",
      search: "Search the guide",
      searchNothing: "Nothing found.",
    },
  },
  de: {
    name: "Deutsch",
    htmlLang: "de",
    numberLocale: "de-DE",
    quotes: ["„", "“"],
    guideDir: "anleitung",
    communityUrl: DRUCKTIPPS_FORUM,
    readme: "README.de.md",
    quickstartAnchor: "schnellstart-unter-windows",
    legal: { imprint: "Impressum", privacy: "Datenschutz" },
    keyNames: { Ctrl: "Strg", Shift: "Umschalt", Delete: "Entf", Backspace: "Rücktaste", Home: "Pos1", Click: "Klick", RightClick: "Rechtsklick", Drag: "Ziehen" },
    asciiUmlauts: true,
    complete: true,
    guide: {
      site: "layerling Anleitung",
      home: "Anleitung",
      openEditor: "Zum Editor",
      backToEditor: "Zurück zum Editor",
      editorElsewhere: "Der Editor ist schon in einem anderen Tab offen - wechsle einfach dorthin.",
      chapters: "Kapitel",
      onThisPage: "Auf dieser Seite",
      previous: "Vorheriges Kapitel",
      next: "Nächstes Kapitel",
      overviewLead: "Alles, was layerling kann, Schritt für Schritt. Die Bilder entstehen aus dem laufenden Programm und werden mit jeder Fassung neu aufgenommen.",
      sourceNote: "Diese Anleitung wächst mit dem Programm. Fehlt dir etwas oder stimmt etwas nicht, sag es im",
      forum: "Forum",
      notTranslated: "Dieses Kapitel ist noch nicht in deine Sprache übersetzt. Es folgt der englische Text.",
      languageMenu: "Sprache",
      search: "Anleitung durchsuchen",
      searchNothing: "Nichts gefunden.",
    },
  },
  ja: {
    name: "日本語",
    htmlLang: "ja",
    numberLocale: "ja-JP",
    quotes: ["「", "」"],
    guideDir: "guide-ja",
    communityUrl: GITHUB_DISCUSSIONS,
    readme: "README.md",
    quickstartAnchor: "windows-quickstart",
    legal: { imprint: "運営者情報", privacy: "プライバシーポリシー" },
    keyNames: { Click: "クリック", RightClick: "右クリック", Drag: "ドラッグ" },
    asciiUmlauts: false,
    complete: false,
    guide: {
      site: "layerling ユーザーガイド",
      home: "ユーザーガイド",
      openEditor: "エディターを開く",
      backToEditor: "エディターに戻る",
      editorElsewhere: "エディターはもう別のタブで開いています。そのタブに切り替えてください。",
      chapters: "章",
      onThisPage: "このページの内容",
      previous: "前の章",
      next: "次の章",
      overviewLead: "layerling でできることを、じゅんばんに説明します。画像は動いているプログラムからとったもので、新しいバージョンが出るたびにとり直しています。",
      sourceNote: "このガイドはプログラムといっしょに育っていきます。足りないところやまちがいがあったら、ここで教えてください:",
      forum: "ディスカッション",
      notTranslated: "この章はまだ日本語になっていません。このあとは英語で書かれています。",
      languageMenu: "言語",
      search: "ガイドを検索",
      searchNothing: "見つかりませんでした。",
    },
  },
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * The language a browser asks for, as far as we can serve it. `de-AT` and plain `de` both mean
 * German; anything layerling does not speak falls back to English.
 */
export function languageFromTag(tag: string | undefined | null): Language | null {
  const primary = tag?.trim().toLowerCase().split("-")[0];
  return isLanguage(primary) ? primary : null;
}
