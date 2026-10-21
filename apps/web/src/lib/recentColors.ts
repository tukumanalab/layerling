"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * The colours someone mixed themselves, newest first, so the next body gets the
 * same one with a click instead of typing its code again. They are a matter of
 * this browser, not of a design: kept in localStorage, and a page that cannot
 * store them simply shows none.
 */

const STORAGE_KEY = "layerling.recentColors";
const CHANGE_EVENT = "layerling-recent-colors";
export const RECENT_COLOR_LIMIT = 8;

function normalizeColor(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

/** The list after using `color`: it moves to the front, palette colours are left out. */
export function rememberedColors(current: readonly string[], color: string, palette: readonly string[] = []) {
  const normalized = normalizeColor(color);
  if (!normalized) return [...current];
  if (palette.some((entry) => entry.toLowerCase() === normalized)) return [...current];
  return [normalized, ...current.filter((entry) => entry !== normalized)].slice(0, RECENT_COLOR_LIMIT);
}

export function readRecentColors(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const colors = parsed.map(normalizeColor).filter((color): color is string => Boolean(color));
    return colors.filter((color, index) => colors.indexOf(color) === index).slice(0, RECENT_COLOR_LIMIT);
  } catch {
    return [];
  }
}

export function useRecentColors(palette: readonly string[]) {
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => setColors(readRecentColors());
    refresh();
    // Another tab, or another inspector on this page, may have added one.
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, refresh);
    };
  }, []);
  const remember = useCallback((color: string) => {
    const next = rememberedColors(readRecentColors(), color, palette);
    setColors(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Without storage the list lasts as long as the page.
    }
  }, [palette]);
  return { colors, remember };
}

/*
 * The colours someone wants to keep (#507): they stand in a row of their own, are never pushed out
 * by newer ones, and go only when the same button lets go of them. Like the recent ones they belong
 * to this browser.
 */
const KEPT_STORAGE_KEY = "layerling.keptColors";
const KEPT_CHANGE_EVENT = "layerling-kept-colors";
export const KEPT_COLOR_LIMIT = 21;

/** The list after the pin was pressed for `color`: it is kept, or let go when it was kept already. A full list takes no new one. */
export function toggledKeptColors(current: readonly string[], color: string) {
  const normalized = normalizeColor(color);
  if (!normalized) return [...current];
  if (current.includes(normalized)) return current.filter((entry) => entry !== normalized);
  if (current.length >= KEPT_COLOR_LIMIT) return [...current];
  return [...current, normalized];
}

export function readKeptColors(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEPT_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const colors = parsed.map(normalizeColor).filter((color): color is string => Boolean(color));
    return colors.filter((color, index) => colors.indexOf(color) === index).slice(0, KEPT_COLOR_LIMIT);
  } catch {
    return [];
  }
}

export function useKeptColors() {
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => setColors(readKeptColors());
    refresh();
    const onStorage = (event: StorageEvent) => { if (event.key === KEPT_STORAGE_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(KEPT_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(KEPT_CHANGE_EVENT, refresh);
    };
  }, []);
  const toggle = useCallback((color: string) => {
    const next = toggledKeptColors(readKeptColors(), color);
    setColors(next);
    try {
      window.localStorage.setItem(KEPT_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(KEPT_CHANGE_EVENT));
    } catch {
      // Without storage the colours last as long as the page.
    }
  }, []);
  return { colors, toggle };
}
