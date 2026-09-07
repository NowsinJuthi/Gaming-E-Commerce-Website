"use client";

import { useEffect } from "react";
import {
  attachStoredReferral,
  captureReferralFromUrl,
} from "@/lib/affiliate-ref";

export function ReferralTracker() {
  useEffect(() => {
    captureReferralFromUrl();
    attachStoredReferral();

    const onAuth = () => attachStoredReferral();
    window.addEventListener("auth-change", onAuth);
    return () => window.removeEventListener("auth-change", onAuth);
  }, []);

  return null;
}
