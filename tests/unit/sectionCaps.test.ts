import { describe, expect, it } from "vitest";
import type { SectionLoop } from "@/lib/sectionSvg";
import { sectionCapArea, sectionCapMesh } from "@/lib/sectionCaps";

const square = (u: number, v: number, size: number, closed = true): SectionLoop => ({
  points: [{ u, v }, { u: u + size, v }, { u: u + size, v: v + size }, { u, v: v + size }],
  closed,
});

describe("the filled cut of the section view (#516)", () => {
  it("fills a solid", () => {
    expect(sectionCapArea(sectionCapMesh([square(0, 0, 10)]))).toBeCloseTo(100, 6);
  });

  it("leaves a hole inside a solid empty (#516)", () => {
    const mesh = sectionCapMesh([square(0, 0, 20), square(5, 5, 10)]);
    expect(sectionCapArea(mesh)).toBeCloseTo(400 - 100, 6);
  });

  it("fills a body that lies inside a hole again", () => {
    const mesh = sectionCapMesh([square(0, 0, 30), square(5, 5, 20), square(10, 10, 10)]);
    expect(sectionCapArea(mesh)).toBeCloseTo(900 - 400 + 100, 6);
  });

  it("fills separate bodies and a wall with two holes", () => {
    const mesh = sectionCapMesh([square(0, 0, 30), square(5, 5, 8), square(17, 5, 8), square(100, 0, 10)]);
    expect(sectionCapArea(mesh)).toBeCloseTo(900 - 64 - 64 + 100, 6);
  });

  it("ignores open lines and outlines without area", () => {
    expect(sectionCapMesh([square(0, 0, 10, false), { points: [{ u: 0, v: 0 }, { u: 5, v: 0 }, { u: 10, v: 0 }], closed: true }]).triangles).toHaveLength(0);
    expect(sectionCapMesh([]).points).toHaveLength(0);
  });
});
