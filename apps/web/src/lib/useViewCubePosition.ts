"use client";

import { useSyncExternalStore } from "react";
import { getViewCubePosition, subscribeToViewCubePosition, type ViewCubePosition } from "@/lib/viewCubePosition";

export function useViewCubePosition(): ViewCubePosition {
  return useSyncExternalStore(subscribeToViewCubePosition, getViewCubePosition, () => "top-left");
}
