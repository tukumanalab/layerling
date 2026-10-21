import { describe, expect, it } from "vitest";
import { POSITION_TYPED_LIMIT, positionReach } from "@/lib/workplaneSettings";

describe("how far a position reaches (#425)", () => {
  it("is never less than the 220 mm it always was", () => {
    expect(positionReach({ width: 100, depth: 100 })).toBe(220);
    expect(positionReach({ width: 200, depth: 200 })).toBe(300);
  });

  it("follows the larger side of the plate, a plate and a half across", () => {
    expect(positionReach({ width: 256, depth: 256 })).toBe(384);
    expect(positionReach({ width: 180, depth: 600 })).toBe(900);
  });

  it("goes up to the height of a printer when that is more", () => {
    expect(positionReach({ width: 100, depth: 100 }, 400)).toBe(400);
    expect(positionReach({ width: 256, depth: 256 }, 250)).toBe(384);
    expect(positionReach({ width: 100, depth: 100 }, null)).toBe(220);
  });

  it("lets a number be typed far beyond the slider, up to a guard against a typo", () => {
    expect(POSITION_TYPED_LIMIT).toBeGreaterThanOrEqual(10_000);
    expect(POSITION_TYPED_LIMIT).toBeLessThan(1e9);
  });
});
