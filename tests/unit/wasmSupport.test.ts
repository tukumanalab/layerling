import { describe, expect, it } from "vitest";
import { CAD_KERNEL_NEEDS_SIMD_MESSAGE, wasmSimdSupported } from "@/lib/wasmSupport";
import { ERROR_RULES } from "@/lib/userErrors";

describe("wasmSimdSupported (#350)", () => {
  it("is true where the engine takes a module with a SIMD instruction", () => {
    expect(wasmSimdSupported()).toBe(true);
  });

  it("is false where the engine refuses it, or where validating throws", () => {
    expect(wasmSimdSupported(() => false)).toBe(false);
    expect(wasmSimdSupported(() => { throw new Error("no wasm"); })).toBe(false);
  });

  it("hands the probe to the validator as a wasm module", () => {
    let seen: Uint8Array | null = null;
    wasmSimdSupported((bytes) => { seen = bytes; return true; });
    expect(Array.from(seen!.slice(0, 4))).toEqual([0, 97, 115, 109]);
  });

  it("has its message matched by an error rule, so it shows in the person's language", () => {
    expect(ERROR_RULES.some((rule) => rule.pattern.test(CAD_KERNEL_NEEDS_SIMD_MESSAGE))).toBe(true);
  });
});
