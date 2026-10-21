export const VIEW_CUBE_POSITION_STORAGE_KEY = "layerling.viewCubePosition";

export const VIEW_CUBE_POSITION_OPTIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

export type ViewCubePosition = (typeof VIEW_CUBE_POSITION_OPTIONS)[number];

export function normalizeViewCubePosition(value: unknown): ViewCubePosition {
  return VIEW_CUBE_POSITION_OPTIONS.includes(value as ViewCubePosition) ? (value as ViewCubePosition) : "top-left";
}

/**
 * The corner is a data attribute on <html>; viewCube.css places the cube from
 * it, and moves the camera controls up into the corner the cube left. Top left
 * is the plain stylesheet, so it carries no attribute.
 */
export function applyViewCubePosition(position: ViewCubePosition) {
  if (typeof document === "undefined") return;
  if (position === "top-left") delete document.documentElement.dataset.viewCubePosition;
  else document.documentElement.dataset.viewCubePosition = position;
}

/**
 * Runs in <head> before the page paints, so a cube in another corner does not
 * first show at the top left and then jump.
 */
export const VIEW_CUBE_POSITION_BOOT_SCRIPT = `try{var p=localStorage.getItem(${JSON.stringify(VIEW_CUBE_POSITION_STORAGE_KEY)});if(p==="top-right"||p==="bottom-left"||p==="bottom-right")document.documentElement.dataset.viewCubePosition=p}catch(e){}`;

function readStoredViewCubePosition(): ViewCubePosition {
  try {
    return normalizeViewCubePosition(window.localStorage.getItem(VIEW_CUBE_POSITION_STORAGE_KEY));
  } catch {
    return "top-left";
  }
}

const listeners = new Set<() => void>();
let currentViewCubePosition: ViewCubePosition = typeof window !== "undefined" ? readStoredViewCubePosition() : "top-left";

export function setViewCubePosition(position: ViewCubePosition) {
  currentViewCubePosition = position;
  try {
    window.localStorage.setItem(VIEW_CUBE_POSITION_STORAGE_KEY, position);
  } catch {
    // The corner still applies for this session when storage is unavailable.
  }
  applyViewCubePosition(position);
  listeners.forEach((listener) => listener());
}

export function getViewCubePosition(): ViewCubePosition {
  return currentViewCubePosition;
}

export function subscribeToViewCubePosition(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
