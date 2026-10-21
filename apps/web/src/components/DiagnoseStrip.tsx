"use client";

import { useEffect } from "react";
import { installDiagnose } from "@/lib/diagnose";

/** Starts the diagnostic strip when the address carries `diagnose` (see lib/diagnose.ts); draws nothing itself. */
export function DiagnoseStrip() {
  useEffect(() => {
    installDiagnose();
  }, []);
  return null;
}
