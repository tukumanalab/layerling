import { describe, expect, it } from "vitest";
import { RECENT_COLOR_LIMIT, rememberedColors } from "@/lib/recentColors";

describe("recently used colours", () => {
  it("puts the newest first, once, and keeps the last eight", () => {
    let colors: string[] = [];
    for (let index = 0; index < 10; index += 1) colors = rememberedColors(colors, `#00000${index}`);
    expect(colors).toHaveLength(RECENT_COLOR_LIMIT);
    expect(colors[0]).toBe("#000009");
    expect(rememberedColors(colors, "#000005")).toEqual(["#000005", ...colors.filter((color) => color !== "#000005")]);
  });

  it("writes colours one way and leaves out the palette and anything that is no colour", () => {
    expect(rememberedColors([], "123ABC")).toEqual(["#123abc"]);
    expect(rememberedColors(["#123abc"], "#D41721", ["#d41721"])).toEqual(["#123abc"]);
    expect(rememberedColors(["#123abc"], "red")).toEqual(["#123abc"]);
  });
});

describe("kept colours (#507)", () => {
  it("keeps a colour, in the order they were kept, and lets go of it with the same call", async () => {
    const { toggledKeptColors } = await import("@/lib/recentColors");
    let kept: string[] = [];
    kept = toggledKeptColors(kept, "#123ABC");
    kept = toggledKeptColors(kept, "#00ff00");
    expect(kept).toEqual(["#123abc", "#00ff00"]);
    expect(toggledKeptColors(kept, "#123abc")).toEqual(["#00ff00"]);
  });

  it("takes no new colour when 24 are kept, and ignores what is no colour", async () => {
    const { KEPT_COLOR_LIMIT, toggledKeptColors } = await import("@/lib/recentColors");
    const full = Array.from({ length: KEPT_COLOR_LIMIT }, (_, index) => `#0000${index.toString(16).padStart(2, "0")}`);
    expect(toggledKeptColors(full, "#ffffff")).toEqual(full);
    expect(toggledKeptColors(full, full[3])).toHaveLength(KEPT_COLOR_LIMIT - 1);
    expect(toggledKeptColors(["#123abc"], "not a colour")).toEqual(["#123abc"]);
  });
});
