"use client";

import { useEffect, useState } from "react";
import { isAppleTouchDevice } from "@/lib/fileAccept";
import { penTipPosition } from "@/lib/penHoverTip";

/** The pen has to rest on a control this long before its name appears, as a mouse waits for a tooltip. */
const SHOW_DELAY_MS = 350;

type Tip = { text: string; left: number; top: number };

function titled(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>("[title]");
  const text = element?.getAttribute("title")?.trim();
  return element && text ? { element, text } : null;
}

/**
 * On an iPad the Apple Pencil hovers above the screen, and Safari reports it as a pen that moves without
 * a button down - but it shows no title text for it, which a mouse does (#495). So a pen resting on a
 * control with a title shows that text in a small bubble, after a moment. Only on an iPad or iPhone:
 * elsewhere the browser's own tooltip comes up for a pen as for a mouse, and would show twice.
 */
export function PenHoverTips() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (!isAppleTouchDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0)) return;
    let current: HTMLElement | null = null;
    let timer: number | undefined;
    const hide = () => {
      window.clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "pen" || event.buttons !== 0) return;
      const found = titled(event.target);
      if (!found) {
        if (current) hide();
        return;
      }
      if (found.element === current) return;
      hide();
      current = found.element;
      timer = window.setTimeout(() => {
        // The text is read now: a control may have changed its title while the pen waited.
        const text = found.element.getAttribute("title")?.trim();
        if (!text || !found.element.isConnected) return;
        const position = penTipPosition(found.element.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
        setTip({ text, left: position.left, top: position.top });
      }, SHOW_DELAY_MS);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", hide, true);
    window.addEventListener("pointercancel", hide, true);
    window.addEventListener("keydown", hide, true);
    window.addEventListener("wheel", hide, { capture: true, passive: true });
    window.addEventListener("scroll", hide, true);
    document.addEventListener("pointerleave", hide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("pointercancel", hide, true);
      window.removeEventListener("keydown", hide, true);
      window.removeEventListener("wheel", hide, true);
      window.removeEventListener("scroll", hide, true);
      document.removeEventListener("pointerleave", hide);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className="pen-hover-tip" role="tooltip" style={{ left: tip.left, top: tip.top }}>
      {tip.text}
    </div>
  );
}
