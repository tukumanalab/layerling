/**
 * A diagnostic strip for a device we cannot try ourselves (#524: an iPad on which nothing answers any more
 * after two taps). It exists only when the address carries `diagnose`, for example
 * `https://layerling.com/?editor=1&diagnose=1`, and is plain DOM, not React, so it still draws when the app
 * itself is stuck. It shows whether the page is alive (two counters that stop when it hangs), the last
 * pointer events with the element they hit, and the last errors. A screenshot of it says what happened.
 */

const MAX_EVENTS = 8;
const MAX_ERRORS = 4;

/** "DIV.three-workplane-host" for an element, "-" for anything that is not one. */
export function describeEventTarget(target: unknown): string {
  const element = target as { tagName?: unknown; id?: unknown; className?: unknown } | null;
  if (!element || typeof element.tagName !== "string") return "-";
  const classes = typeof element.className === "string" ? element.className.trim().split(/\s+/)[0] : "";
  const id = typeof element.id === "string" && element.id ? `#${element.id}` : "";
  return `${element.tagName}${id}${classes ? `.${classes}` : ""}`.slice(0, 48);
}

/** One line for a pointer event: type, kind of pointer, id, whether it is the primary one, and what it hit. */
export function describePointerEvent(event: { type: string; pointerType?: string; pointerId?: number; isPrimary?: boolean; target?: unknown }): string {
  const kind = event.pointerType ?? "?";
  const primary = event.isPrimary ? "P" : "-";
  return `${event.type.replace("pointer", "")} ${kind} #${event.pointerId ?? "?"} ${primary} ${describeEventTarget(event.target)}`;
}

type DiagnoseWindow = Window & { __layerlingDiagnose?: boolean };

export function diagnoseRequested(search: string): boolean {
  return new URLSearchParams(search).has("diagnose");
}

export function installDiagnose(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const flagged = window as DiagnoseWindow;
  if (flagged.__layerlingDiagnose || !diagnoseRequested(window.location.search)) return;
  flagged.__layerlingDiagnose = true;

  const box = document.createElement("pre");
  box.setAttribute("data-diagnose", "");
  Object.assign(box.style, {
    position: "fixed",
    left: "4px",
    top: "4px",
    zIndex: "2147483647",
    margin: "0",
    padding: "4px 6px",
    background: "rgba(0,0,0,0.8)",
    color: "#7cfc9a",
    font: "11px/1.3 ui-monospace, Menlo, monospace",
    pointerEvents: "none",
    maxWidth: "min(380px, 85vw)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    borderRadius: "4px",
  });
  document.body.appendChild(box);

  let frames = 0;
  let ticks = 0;
  let moves = 0;
  const events: string[] = [];
  const errors: string[] = [];
  let longest = 0;

  const frame = () => {
    frames += 1;
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);

  const record = (event: PointerEvent) => {
    if (event.type === "pointermove") {
      moves += 1;
      return;
    }
    events.push(`${Math.round(performance.now() / 100) / 10}s ${describePointerEvent(event)}`);
    if (events.length > MAX_EVENTS) events.shift();
  };
  (["pointerdown", "pointerup", "pointercancel", "pointermove"] as const).forEach((type) => window.addEventListener(type, record, true));

  const fail = (text: string) => {
    errors.push(text.replace(/\s+/g, " ").slice(0, 110));
    if (errors.length > MAX_ERRORS) errors.shift();
  };
  window.addEventListener("error", (event) => fail(`error: ${event.message}`));
  window.addEventListener("unhandledrejection", (event) => fail(`rejected: ${String((event.reason as { message?: unknown } | null)?.message ?? event.reason)}`));

  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        longest = Math.max(longest, Math.round(entry.duration));
      });
    }).observe({ entryTypes: ["longtask"] });
  } catch {
    // Not every browser reports long tasks.
  }

  const draw = () => {
    ticks += 1;
    box.textContent = [
      `alive ${ticks}  frames ${frames}  moves ${moves}  longest task ${longest} ms`,
      `${window.innerWidth}x${window.innerHeight}  visual ${Math.round((window.visualViewport?.scale ?? 1) * 100) / 100}x  ${document.visibilityState}`,
      ...events,
      ...errors,
      navigator.userAgent.slice(0, 110),
    ].join("\n");
  };
  draw();
  window.setInterval(draw, 250);
}
