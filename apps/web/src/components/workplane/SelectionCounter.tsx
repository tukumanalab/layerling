"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * While Shift is held and two or more bodies are selected, a small number follows the mouse pointer,
 * just below it: the tally of the selection stays where the eye is while clicking one body after the
 * other (#481). Only a mouse gets it - a finger covers the spot, and the status message of "Select
 * multiple" already says what is going on there. The number is only a tally for the eye, so it is
 * hidden from screen readers, which hear the selection from the status messages.
 *
 * It moves by setting the style of its element directly, not through React state: a pointer move is
 * far too frequent to render a component for.
 */
export function SelectionCounter({ count, hostRef }: { count: number; hostRef: RefObject<HTMLElement | null> }) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(false);
  const insideRef = useRef(false);
  const pointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const badge = badgeRef.current;
      if (!badge) return;
      const point = pointRef.current;
      const visible = count >= 2 && shiftRef.current && insideRef.current && point !== null;
      badge.hidden = !visible;
      if (visible && point) badge.style.transform = `translate(${Math.round(point.x + 14)}px, ${Math.round(point.y + 22)}px)`;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        insideRef.current = false;
        update();
        return;
      }
      const host = hostRef.current;
      const rect = host?.getBoundingClientRect();
      // Over the panels and buttons that float above the work area the number would only be in the way.
      const overPanel = event.target instanceof Element && Boolean(event.target.closest("aside, [role='dialog'], input, select, textarea"));
      insideRef.current = !overPanel && Boolean(rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
      shiftRef.current = event.shiftKey;
      pointRef.current = { x: event.clientX, y: event.clientY };
      update();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Shift") return;
      shiftRef.current = event.type === "keydown";
      update();
    };
    const onBlur = () => {
      shiftRef.current = false;
      update();
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", onBlur);
    update();
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [count, hostRef]);

  return (
    <div ref={badgeRef} className="selection-counter" aria-hidden="true" hidden>
      {count}
    </div>
  );
}
