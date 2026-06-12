"use client";

import { useEffect } from "react";

/** Runs `callback` when the app returns to the foreground, and optionally
 *  on a polling interval (skipped while the app is hidden). */
export function useForegroundRefresh(callback: () => void, intervalMs?: number) {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") callback();
    };
    const id = intervalMs ? setInterval(refresh, intervalMs) : null;
    document.addEventListener("visibilitychange", refresh);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [callback, intervalMs]);
}
