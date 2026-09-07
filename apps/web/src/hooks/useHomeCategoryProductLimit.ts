"use client";

import { useEffect, useState } from "react";

/** Max products in one homepage category row (matches responsive grid). */
export function useHomeCategoryProductLimit(): number {
  const [limit, setLimit] = useState(2);

  useEffect(() => {
    const lg = window.matchMedia("(min-width: 1024px)");
    const md = window.matchMedia("(min-width: 768px)");

    const sync = () => {
      if (lg.matches) setLimit(5);
      else if (md.matches) setLimit(4);
      else setLimit(2);
    };

    sync();
    lg.addEventListener("change", sync);
    md.addEventListener("change", sync);
    return () => {
      lg.removeEventListener("change", sync);
      md.removeEventListener("change", sync);
    };
  }, []);

  return limit;
}
