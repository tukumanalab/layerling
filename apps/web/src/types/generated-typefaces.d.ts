/**
 * The typeface files scripts/build-japanese-typeface.mjs writes to src/generated/ before dev and
 * build. Until it has run the folder is empty, and this keeps the type check from needing it.
 */
declare module "@/generated/*.typeface.json" {
  const typeface: unknown;
  export default typeface;
}
