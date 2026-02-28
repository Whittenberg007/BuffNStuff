"use client";

import { useEffect } from "react";
import { initializeNativeApp } from "@/lib/capacitor/init";

export function NativeInit() {
  useEffect(() => {
    initializeNativeApp();
  }, []);

  return null;
}
