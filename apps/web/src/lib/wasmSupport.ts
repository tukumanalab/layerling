/**
 * Whether this browser can run the CAD kernel at all (#350).
 *
 * The kernel (occt-wasm) is built with WebAssembly SIMD, so an engine without it stops while it
 * compiles the module with "Wasm SIMD unsupported". That came out as "the CAD kernel ran out of room",
 * which sent a person on a hunt for memory. A module of a few bytes that uses a SIMD instruction
 * tells the two cases apart before the 22 MB kernel is fetched.
 */
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

export const CAD_KERNEL_NEEDS_SIMD_MESSAGE =
  "The CAD kernel needs WebAssembly SIMD, which this browser or computer does not offer. Use a current Chrome, Edge, Firefox or Safari.";

let cached: boolean | null = null;

export function wasmSimdSupported(validate?: (bytes: Uint8Array) => boolean): boolean {
  if (validate) return safeValidate(validate);
  if (cached === null) {
    cached = typeof WebAssembly === "object" && typeof WebAssembly.validate === "function"
      ? safeValidate((bytes) => WebAssembly.validate(bytes as BufferSource))
      : false;
  }
  return cached;
}

function safeValidate(validate: (bytes: Uint8Array) => boolean): boolean {
  try {
    return validate(SIMD_PROBE);
  } catch {
    return false;
  }
}

/** Throws the message above before the kernel is fetched, if this engine cannot run it. */
export function assertCadKernelRunnable(): void {
  if (!wasmSimdSupported()) throw new Error(CAD_KERNEL_NEEDS_SIMD_MESSAGE);
}
