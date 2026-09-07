"use client";

import { create } from "zustand";
import type { SiteAppearance } from "@/lib/site-appearance";
import { DEFAULT_SITE_APPEARANCE } from "@/lib/site-appearance";

export type SiteBrand = Pick<
  SiteAppearance,
  | "logoUrlLight"
  | "logoUrlDark"
  | "logoUrlAdmin"
  | "logoUrlFooterLight"
  | "logoUrlFooterDark"
  | "logoAlt"
  | "siteName"
>;

type SiteBrandState = SiteBrand & {
  setBrand: (patch: Partial<SiteBrand>) => void;
};

export const useSiteBrandStore = create<SiteBrandState>((set) => ({
  logoUrlLight: DEFAULT_SITE_APPEARANCE.logoUrlLight,
  logoUrlDark: DEFAULT_SITE_APPEARANCE.logoUrlDark,
  logoUrlAdmin: DEFAULT_SITE_APPEARANCE.logoUrlAdmin,
  logoUrlFooterLight: DEFAULT_SITE_APPEARANCE.logoUrlFooterLight,
  logoUrlFooterDark: DEFAULT_SITE_APPEARANCE.logoUrlFooterDark,
  logoAlt: DEFAULT_SITE_APPEARANCE.logoAlt,
  siteName: DEFAULT_SITE_APPEARANCE.siteName,
  setBrand: (patch) => set((state) => ({ ...state, ...patch })),
}));

export function applySiteBrand(
  appearance: Pick<
    SiteAppearance,
    | "logoUrlLight"
  | "logoUrlDark"
  | "logoUrlAdmin"
  | "logoUrlFooterLight"
  | "logoUrlFooterDark"
  | "logoAlt"
  | "siteName"
  >,
): void {
  useSiteBrandStore.getState().setBrand({
    logoUrlLight: appearance.logoUrlLight ?? "",
    logoUrlDark: appearance.logoUrlDark ?? "",
    logoUrlAdmin: appearance.logoUrlAdmin ?? "",
    logoUrlFooterLight: appearance.logoUrlFooterLight ?? "",
    logoUrlFooterDark: appearance.logoUrlFooterDark ?? "",
    logoAlt: appearance.logoAlt || DEFAULT_SITE_APPEARANCE.logoAlt,
    siteName: appearance.siteName || DEFAULT_SITE_APPEARANCE.siteName,
  });
}
