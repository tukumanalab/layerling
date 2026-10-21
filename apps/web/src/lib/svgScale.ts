/**
 * An SVG drawn larger or smaller: everything inside the root element is wrapped in one group that
 * scales it, so the mesh and the sketch of the outlines, both read from the same text, come out in
 * the same size (#448).
 */
export function scaleSvgText(source: string, factor: number): string {
  if (!(factor > 0) || !Number.isFinite(factor) || Math.abs(factor - 1) < 1e-9) return source;
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (!root || root.localName !== "svg" || root.querySelector("parsererror")) return source;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("transform", `scale(${factor})`);
  while (root.firstChild) group.appendChild(root.firstChild);
  root.appendChild(group);
  return new XMLSerializer().serializeToString(document);
}
