"use client";

import { useEffect, useState } from "react";

function readLgScreen(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
}

/** Tailwind `lg` breakpoint — 1024px. */
export function useLgScreen(): boolean {
  const [isLg, setIsLg] = useState(readLgScreen);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isLg;
}
