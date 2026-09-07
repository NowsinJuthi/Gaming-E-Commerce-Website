"use client";

import { useEffect, useState } from "react";
import { isGuestFromAccessToken } from "@/lib/chat-access";
import { isRegisteredUserLoggedIn } from "@/lib/guest-checkout";

/** Registered (non-guest) login check, kept in sync with auth changes. */
export function useRegisteredLogin(): boolean {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const sync = () => {
      const token = localStorage.getItem("accessToken");
      setLoggedIn(
        isRegisteredUserLoggedIn() && !isGuestFromAccessToken(token),
      );
    };
    sync();
    window.addEventListener("auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return loggedIn;
}

export function buildLoginRedirectUrl(
  nextPath: string,
): `/login?next=${string}` {
  return `/login?next=${encodeURIComponent(nextPath || "/")}`;
}
