"use client";

import { create } from "zustand";
import { DEFAULT_SITE_APPEARANCE } from "@/lib/site-appearance";

type AdminFaviconState = {
  adminFaviconUrl: string;
  setAdminFaviconUrl: (url: string) => void;
};

export const useAdminFaviconStore = create<AdminFaviconState>((set) => ({
  adminFaviconUrl: DEFAULT_SITE_APPEARANCE.adminFaviconUrl,
  setAdminFaviconUrl: (adminFaviconUrl) => set({ adminFaviconUrl }),
}));

export function applyAdminFavicon(adminFaviconUrl: string): void {
  useAdminFaviconStore.getState().setAdminFaviconUrl(adminFaviconUrl ?? "");
}
