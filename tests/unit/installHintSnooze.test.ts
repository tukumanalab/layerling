import { describe, expect, it } from "vitest";
import { INSTALL_HINT_SNOOZE_MS, installHintSnoozed } from "@/lib/installHint";

describe("the install hint rests for two weeks after 'Not now'", () => {
  const now = Date.UTC(2026, 9, 17, 12, 0, 0);

  it("shows the hint when it was never put off", () => {
    expect(installHintSnoozed(null, now)).toBe(false);
    expect(installHintSnoozed("", now)).toBe(false);
    expect(installHintSnoozed("not a number", now)).toBe(false);
  });

  it("holds it back for two weeks", () => {
    expect(installHintSnoozed(String(now - 60_000), now)).toBe(true);
    expect(installHintSnoozed(String(now - 13 * 24 * 3600 * 1000), now)).toBe(true);
  });

  it("shows it again after the two weeks", () => {
    expect(installHintSnoozed(String(now - INSTALL_HINT_SNOOZE_MS), now)).toBe(false);
    expect(installHintSnoozed(String(now - 20 * 24 * 3600 * 1000), now)).toBe(false);
  });

  it("does not trust a time in the future", () => {
    expect(installHintSnoozed(String(now + 3600_000), now)).toBe(false);
  });
});
