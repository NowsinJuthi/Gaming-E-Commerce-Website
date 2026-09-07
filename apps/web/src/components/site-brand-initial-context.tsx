"use client";

import { createContext, useContext } from "react";
import type { SiteBrand } from "@/stores/site-brand-store";

const SiteBrandInitialContext = createContext<SiteBrand | null>(null);

export function SiteBrandInitialProvider({
  brand,
  children,
}: {
  brand: SiteBrand;
  children: React.ReactNode;
}) {
  return (
    <SiteBrandInitialContext.Provider value={brand}>
      {children}
    </SiteBrandInitialContext.Provider>
  );
}

/** Server-provided brand snapshot — used until the client store hydrates. */
export function useInitialSiteBrand(): SiteBrand | null {
  return useContext(SiteBrandInitialContext);
}
