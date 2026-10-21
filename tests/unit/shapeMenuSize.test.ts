import { describe, expect, it } from "vitest";
import {
  clampShapeMenuLength,
  parseShapeMenuSize,
  serializeShapeMenuSize,
  SHAPE_MENU_ICONS_ONLY_BELOW,
  SHAPE_MENU_MAX_WIDTH,
  SHAPE_MENU_MIN_HEIGHT,
  SHAPE_MENU_MIN_WIDTH,
  shapeMenuShowsNames,
} from "@/lib/shapeMenuSize";

describe("the size of the shape library (#505)", () => {
  it("shows the names unless the panel was pulled narrower than a column with its name", () => {
    expect(shapeMenuShowsNames(null)).toBe(true);
    expect(shapeMenuShowsNames(900)).toBe(true);
    expect(shapeMenuShowsNames(SHAPE_MENU_ICONS_ONLY_BELOW)).toBe(true);
    expect(shapeMenuShowsNames(SHAPE_MENU_ICONS_ONLY_BELOW - 1)).toBe(false);
    expect(shapeMenuShowsNames(SHAPE_MENU_MIN_WIDTH)).toBe(false);
  });

  it("keeps a stored size and clamps one that is out of range", () => {
    expect(parseShapeMenuSize(JSON.stringify({ width: 420, height: 500 }))).toEqual({ width: 420, height: 500 });
    expect(parseShapeMenuSize(JSON.stringify({ width: 10, height: 20 }))).toEqual({ width: SHAPE_MENU_MIN_WIDTH, height: SHAPE_MENU_MIN_HEIGHT });
    expect(parseShapeMenuSize(JSON.stringify({ width: 99999, height: null }))).toEqual({ width: SHAPE_MENU_MAX_WIDTH, height: null });
  });

  it("falls back to the usual size for storage that is missing or broken", () => {
    const none = { width: null, height: null };
    expect(parseShapeMenuSize(null)).toEqual(none);
    expect(parseShapeMenuSize("not json")).toEqual(none);
    expect(parseShapeMenuSize("42")).toEqual(none);
    expect(parseShapeMenuSize(JSON.stringify({ width: "wide", height: Number.NaN }))).toEqual(none);
  });

  it("stores nothing once both sides are back to the usual size", () => {
    expect(serializeShapeMenuSize({ width: null, height: null })).toBeNull();
    expect(parseShapeMenuSize(serializeShapeMenuSize({ width: 300, height: null }))).toEqual({ width: 300, height: null });
  });

  it("rounds a pulled length to whole pixels inside its limits", () => {
    expect(clampShapeMenuLength(250.6, 120, 2400)).toBe(251);
    expect(clampShapeMenuLength(5, 120, 2400)).toBe(120);
    expect(clampShapeMenuLength(9000, 120, 2400)).toBe(2400);
  });
});
