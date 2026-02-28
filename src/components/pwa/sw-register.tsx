"use client";

import { useEffect } from "react";
import { isNative } from "@/lib/capacitor/platform";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Skip service worker on native — Capacitor handles caching
    if (isNative()) return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed
      });
    }
  }, []);

  return null;
}
