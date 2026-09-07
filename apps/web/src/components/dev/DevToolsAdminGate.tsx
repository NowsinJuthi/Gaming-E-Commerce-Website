"use client";

import { useEffect } from "react";
import { syncDevToolsAdminVisibility } from "@/lib/dev-tools-admin";

export function DevToolsAdminGate() {
  useEffect(() => {
    syncDevToolsAdminVisibility();

    const onAuthChange = () => syncDevToolsAdminVisibility();
    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);

    return () => {
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
      document.documentElement.classList.remove("dev-tools-admin");
    };
  }, []);

  return null;
}
