import { isAppleTouchDevice } from "@/lib/fileAccept";

/**
 * Whether a finger or a stylus is the main way into this device. Chrome and Android answer the media
 * queries as expected (coarse pointer, nothing to hover with); Safari on an iPad has answered them
 * differently from one iPadOS version to the next, with a trackpad or a Pencil attached, so an iPad
 * and an iPhone count by what they call themselves, whatever the queries say (#467).
 */
export function isTouchFirst(input: { coarse: boolean; hoverNone: boolean; userAgent: string; maxTouchPoints: number }) {
  return (input.coarse && input.hoverNone) || isAppleTouchDevice(input.userAgent, input.maxTouchPoints);
}
