"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { GuideHelpLink } from "@/components/GuideHelpLink";
import { guideHref } from "@/lib/guideLinks";
import { loadGuideIndex, lookupHelp, resolveHelpTarget, type HelpResult } from "@/lib/guideHelp";
import { getLanguage, t } from "@/lib/i18n";
import { useLanguage } from "@/lib/useLanguage";
import { useMovablePanel } from "@/lib/useMovablePanel";

/** What stays itself while the mode is on: the window and the button that leaves the mode. */
const EXEMPT = "[data-help-window], [data-help-exempt]";

/** The events that would start or finish an action of the program; the mode keeps them from it. */
const BLOCKED_POINTER_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick", "auxclick", "contextmenu", "dragstart"] as const;
/** On a touch screen the tap must still become a click, so these are only stopped, not cancelled. */
const BLOCKED_TOUCH_EVENTS = ["touchstart", "touchend"] as const;

/** A key that goes on doing its job: it moves the focus, or presses the button that has it. */
const FREE_KEYS = new Set(["Tab", "Enter", " ", "Shift", "Control", "Meta", "Alt", "F1"]);

type Asked =
  | { state: "nothing" }
  | { state: "loading"; name: string }
  | { state: "done"; name: string; result: HelpResult; href: string | null }
  | { state: "panel"; name: string; href: string }
  | { state: "noIndex"; name: string };

/**
 * A control that is switched off ignores the pointer, and a click lands on whatever lies behind it.
 * The help is about it all the same - "why can I not use this?" is a question for the guide -, so the
 * controls that are off are measured by hand: the smallest one under the point wins.
 */
function disabledControlAt(x: number, y: number): Element | null {
  let found: Element | null = null;
  let smallest = Infinity;
  document.querySelectorAll("button:disabled, button.disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled=true]").forEach((control) => {
    if (control.closest(EXEMPT)) return;
    const rect = control.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
    const area = rect.width * rect.height;
    if (area < smallest) {
      smallest = area;
      found = control;
    }
  });
  return found;
}

/** What is under the pointer, counting the controls that are switched off. */
function elementAt(x: number, y: number, fallback: Element | null): Element | null {
  return disabledControlAt(x, y) ?? fallback;
}

function setHover(element: Element | null) {
  const previous = document.querySelector("[data-help-hover]");
  if (previous === element) return;
  previous?.removeAttribute("data-help-hover");
  element?.setAttribute("data-help-hover", "");
}

/**
 * Interactive Help. While it is mounted every click on an element of the program asks the user
 * guide about that element instead of doing what the element does: the element under the pointer
 * is outlined, a click opens a small window with the guide's part about it. Esc, or the button that
 * switched it on, leaves it. All of it runs in the browser, on the guide's search index.
 */
export function InteractiveHelp({ onExit }: { onExit: () => void }) {
  useLanguage();
  const language = getLanguage();
  const [asked, setAsked] = useState<Asked | null>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const requestRef = useRef(0);
  const movable = useMovablePanel<HTMLElement>("layerling.editor.interactiveHelpPosition", {
    floatingStyle: { right: "auto", bottom: "auto" },
    area: (panel) => panel.ownerDocument.querySelector<HTMLElement>(".workplane-stage"),
  });

  useEffect(() => {
    document.body.classList.add("help-mode");
    const outside = (event: Event) => !(event.target instanceof Element && event.target.closest(EXEMPT));

    const block = (event: Event) => {
      if (!outside(event)) return;
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!event.type.startsWith("touch")) event.preventDefault();
    };

    const ask = (event: MouseEvent) => {
      if (!outside(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const hit = event.target instanceof Element ? elementAt(event.clientX, event.clientY, event.target) : null;
      const target = hit ? resolveHelpTarget(hit) : null;
      const request = requestRef.current + 1;
      requestRef.current = request;
      if (!target) {
        setAsked({ state: "nothing" });
        return;
      }
      if (!target.name || target.sectionOnly) {
        setAsked(target.guideHref ? { state: "panel", name: target.name, href: target.guideHref } : { state: "nothing" });
        return;
      }
      setAsked({ state: "loading", name: target.name });
      void loadGuideIndex(language).then((index) => {
        // A later click has its own answer coming.
        if (requestRef.current !== request) return;
        if (!index) {
          setAsked({ state: "noIndex", name: target.name });
          return;
        }
        setAsked({ state: "done", name: target.name, result: lookupHelp(index, target.name, language), href: target.guideHref });
      });
    };

    const hover = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const under = elementAt(event.clientX, event.clientY, document.elementFromPoint(event.clientX, event.clientY));
      if (!under || under.closest(EXEMPT)) {
        setHover(null);
        document.body.classList.remove("help-void");
        return;
      }
      const target = resolveHelpTarget(under);
      setHover(target?.element ?? null);
      // Where the help has nothing to say, the pointer shows it before a click is wasted (#424).
      document.body.classList.toggle("help-void", !target);
    };

    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        exitRef.current();
        return;
      }
      // Keys that would change the design wait; the ones that move through the page and press the focused button go on.
      if (FREE_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
      // The button that switched the mode on keeps the focus; the keys it gets are not its own either.
      if (event.target instanceof Element && event.target.closest("[data-help-window]")) return;
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const options = { capture: true, passive: false } as const;
    BLOCKED_POINTER_EVENTS.forEach((type) => window.addEventListener(type, block, options));
    BLOCKED_TOUCH_EVENTS.forEach((type) => window.addEventListener(type, block, options));
    window.addEventListener("click", ask, options);
    window.addEventListener("pointermove", hover, { capture: true, passive: true });
    window.addEventListener("keydown", keys, true);
    return () => {
      document.body.classList.remove("help-mode", "help-void");
      setHover(null);
      BLOCKED_POINTER_EVENTS.forEach((type) => window.removeEventListener(type, block, options));
      BLOCKED_TOUCH_EVENTS.forEach((type) => window.removeEventListener(type, block, options));
      window.removeEventListener("click", ask, options);
      window.removeEventListener("pointermove", hover, { capture: true });
      window.removeEventListener("keydown", keys, true);
    };
  }, [language]);

  if (!asked) return null;
  const title = t("interactiveHelp.title");
  const quoted = (name: string) => (name ? t("interactiveHelp.named", { name }) : "");
  const result = asked.state === "done" ? asked.result : null;
  const best = result?.best ?? null;
  const openHref = best?.entry.u ?? (asked.state === "done" || asked.state === "panel" ? asked.href : null);
  const searchHref = guideHref(language);

  return (
    <aside
      className="edge-modifier-panel interactive-help-window"
      data-help-window
      ref={movable.panelRef}
      style={movable.style}
      aria-label={title}
      aria-live="polite"
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="edge-modifier-header movable" title={t("panel.moveHint")} {...movable.handleProps}>
        <div>
          <strong>{title}</strong>
          <span>{t("interactiveHelp.subtitle")}</span>
        </div>
        <div className="panel-header-actions">
          <GuideHelpLink section="interactiveHelp" />
          <button type="button" aria-label={t("interactiveHelp.close")} onClick={() => setAsked(null)}><X size={20} /></button>
        </div>
      </div>

      {asked.state === "nothing" ? <p className="interactive-help-note">{t("interactiveHelp.nothing")}</p> : null}
      {asked.state !== "nothing" && asked.name ? <div className="edge-modifier-target"><strong>{quoted(asked.name)}</strong></div> : null}
      {asked.state === "loading" ? <p className="interactive-help-note">{t("interactiveHelp.loading")}</p> : null}
      {asked.state === "noIndex" ? <p className="interactive-help-note">{t("interactiveHelp.noIndex")}</p> : null}
      {asked.state === "panel" ? <p className="interactive-help-note">{t(asked.name ? "interactiveHelp.sectionOnly" : "interactiveHelp.panelOnly")}</p> : null}
      {asked.state === "done" && !best ? <p className="interactive-help-note">{t("interactiveHelp.noMatch", { name: asked.name })}</p> : null}

      {best ? (
        <section className="interactive-help-answer">
          <small>{best.entry.h ? `${best.entry.c} › ${best.entry.h}` : best.entry.c}</small>
          <p>{best.summary}</p>
        </section>
      ) : null}

      {result && result.more.length > 0 ? (
        <section className="interactive-help-more">
          <small>{t("interactiveHelp.also")}</small>
          <ul>
            {result.more.map((match) => (
              <li key={match.entry.u}>
                <a href={match.entry.u} target="_blank" rel="noreferrer">{match.entry.h ? `${match.entry.c} › ${match.entry.h}` : match.entry.c}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="edge-modifier-footer">
        {asked.state === "done" && !best ? <a className="secondary" href={searchHref} target="_blank" rel="noreferrer">{t("interactiveHelp.search")}</a> : null}
        {openHref ? <a className="primary" href={openHref} target="_blank" rel="noreferrer">{t("interactiveHelp.open")}</a> : null}
        {asked.state === "noIndex" || asked.state === "nothing" ? <a className="secondary" href={searchHref} target="_blank" rel="noreferrer">{t("interactiveHelp.search")}</a> : null}
      </div>
    </aside>
  );
}
