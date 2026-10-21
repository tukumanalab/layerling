"use client";

import { BookOpen, TabletSmartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { guideHref } from "@/lib/guideLinks";
import { t } from "@/lib/i18n";
import { isTouchFirst } from "@/lib/touchFirst";
import { useLanguage } from "@/lib/useLanguage";

const DISMISSED_KEY = "layerling.tabletHintDismissed";
/** In the editor the card waits this long, so it does not meet someone who has just opened a design. */
const EDITOR_DELAY_MS = 15_000;

/** A device whose main way in is a finger: a touch screen without a mouse or trackpad that can hover, or an iPad or iPhone. */
function usesTouchFirst() {
  return isTouchFirst({
    coarse: window.matchMedia("(pointer: coarse)").matches,
    hoverNone: window.matchMedia("(hover: none)").matches,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

/**
 * A card on the start page, and floating in the editor, for a tablet or phone: there is a chapter of the guide for fingers and
 * styluses. Shown once where touch is the main input, never on a computer with a mouse, and gone for
 * good once it is closed - it must not nag (#467).
 */
export function TabletHint({ variant = "dashboard" }: { variant?: "dashboard" | "editor" }) {
  const language = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!usesTouchFirst()) return;
    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Storage blocked: show the hint, it just cannot remember being closed.
    }
    // On the start page it stands there at once; in the editor it floats up after someone has been working
    // a moment, for those who come straight into a design (the installed app opens the last one).
    if (variant !== "editor") {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), EDITOR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [variant]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // nothing to remember it in
    }
  };

  return (
    <section className={variant === "editor" ? "install-app-hint install-app-hint-floating tablet-hint" : "install-app-hint tablet-hint"} aria-label={t("tabletHint.title")}>
      <span className="install-app-hint-icon" aria-hidden="true">
        <TabletSmartphone size={20} strokeWidth={2.4} />
      </span>
      <div className="install-app-hint-text">
        <strong>{t("tabletHint.title")}</strong>
        <span>{t("tabletHint.body")}</span>
      </div>
      <a className="install-app-hint-button" href={guideHref(language, "tablet")} target="_blank" rel="noreferrer" onClick={dismiss}>
        <BookOpen size={16} strokeWidth={2.6} />
        <span>{t("tabletHint.open")}</span>
      </a>
      <button className="install-app-hint-close" type="button" aria-label={t("tabletHint.dismiss")} title={t("tabletHint.dismiss")} onClick={dismiss}>
        <X size={16} />
      </button>
    </section>
  );
}
