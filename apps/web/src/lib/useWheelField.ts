import { useEffect, useRef, type RefObject } from "react";
import { selectWholeValue } from "@/lib/numberField";
import { wheelTurn } from "@/lib/wheelValueStep";

export type WheelFieldTurn = {
  /** +1 for a turn that raises the value (wheel away from the user), -1 for one that lowers it. */
  direction: 1 | -1;
  keys: { shift: boolean; ctrl: boolean; alt: boolean };
};

/**
 * The mouse wheel in a number field that has been clicked (#226, #536): the same for every field, so the panels
 * of the tools (chamfer, hollow, split, section view ...) turn the wheel like the properties of a shape do.
 * Only a field that has the keyboard focus *and* is being edited reacts, so a panel still scrolls under a pointer
 * that merely passes over one. The listener is a native one: React's wheel listeners are passive and could not stop
 * the scroll. `onTurn` returns the shown text of the new value; the whole value is selected again afterwards so
 * that typing replaces it, as after the click.
 */
export function useWheelField(
  inputRef: RefObject<HTMLInputElement | null>,
  enabled: boolean,
  onTurn: (turn: WheelFieldTurn) => void,
): void {
  const latest = useRef({ enabled, onTurn });
  latest.current = { enabled, onTurn };
  useEffect(() => {
    // On the document, so that a field which is only drawn later (a popover) is found as well.
    const onWheel = (event: WheelEvent) => {
      const input = inputRef.current;
      const turn = wheelTurn(event);
      if (!input || event.target !== input || !latest.current.enabled || document.activeElement !== input || turn === 0) return;
      event.preventDefault();
      latest.current.onTurn({
        direction: turn < 0 ? 1 : -1,
        keys: { shift: event.shiftKey, ctrl: event.ctrlKey, alt: event.altKey },
      });
      // After the render that writes the new text into the field.
      window.requestAnimationFrame(() => {
        if (document.activeElement === input) selectWholeValue(input);
      });
    };
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, [inputRef]);
}
