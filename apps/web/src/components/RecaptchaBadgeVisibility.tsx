"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** reCAPTCHA v3 injects a fixed bottom-right badge once its script loads (e.g. after login). */
const SHOW_BADGE_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/contact",
];

function shouldShowRecaptchaBadge(pathname: string | null): boolean {
  if (!pathname) return false;
  return SHOW_BADGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function RecaptchaBadgeVisibility() {
  const pathname = usePathname();

  useEffect(() => {
    const show = shouldShowRecaptchaBadge(pathname);
    document.body.classList.toggle("recaptcha-badge-visible", show);
    return () => {
      document.body.classList.remove("recaptcha-badge-visible");
    };
  }, [pathname]);

  return null;
}
