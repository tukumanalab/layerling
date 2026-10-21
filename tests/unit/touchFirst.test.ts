import { describe, expect, it } from "vitest";
import { isTouchFirst } from "@/lib/touchFirst";

const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("a device that is used by touch first (#467)", () => {
  it("knows an iPad that calls itself a Mac, whatever the media queries answer", () => {
    expect(isTouchFirst({ coarse: false, hoverNone: false, userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe(true);
    expect(isTouchFirst({ coarse: true, hoverNone: false, userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe(true);
  });

  it("knows an iPhone", () => {
    expect(isTouchFirst({ coarse: false, hoverNone: false, userAgent: IPHONE, maxTouchPoints: 5 })).toBe(true);
  });

  it("knows an Android tablet by its queries", () => {
    expect(isTouchFirst({ coarse: true, hoverNone: true, userAgent: ANDROID, maxTouchPoints: 5 })).toBe(true);
  });

  it("leaves a Mac and a Windows computer alone, a touch screen on a laptop included", () => {
    expect(isTouchFirst({ coarse: false, hoverNone: false, userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe(false);
    expect(isTouchFirst({ coarse: false, hoverNone: false, userAgent: WINDOWS, maxTouchPoints: 10 })).toBe(false);
  });
});
