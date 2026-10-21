import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../../apps/web/src/app/globals.css"), "utf8");

describe("Interactive Help and greyed-out buttons (#424)", () => {
  it("lets the pointer pass through a disabled control while the help is on", () => {
    // A disabled button gets no mouse event in the browser; without this rule the click was lost and the help stayed silent.
    const rule = css.match(/body\.help-mode :is\(button, input, select, textarea\):disabled \{([^}]*)\}/);
    expect(rule, "rule for disabled controls in help mode").not.toBeNull();
    expect(rule![1]).toMatch(/pointer-events:\s*none/);
  });
});
