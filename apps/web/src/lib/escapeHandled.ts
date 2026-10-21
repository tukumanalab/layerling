/**
 * An Escape that the work area has already used to cancel a drag (#440). The editor's own Escape handling
 * (put down the tool, then clear the selection) skips such a key press, whichever of the two listeners runs first.
 */
const handled = new WeakSet<Event>();

export function markEscapeHandled(event: Event) {
  handled.add(event);
}

export function escapeWasHandled(event: Event) {
  return handled.has(event);
}
