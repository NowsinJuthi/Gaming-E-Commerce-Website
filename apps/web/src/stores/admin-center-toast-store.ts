"use client";

import { create } from "zustand";

export type AdminCenterToastState = {
  text: string;
  ok: boolean;
};

type AdminCenterToastStore = {
  toast: AdminCenterToastState | null;
  show: (text: string, ok?: boolean) => void;
  hide: () => void;
};

export const useAdminCenterToastStore = create<AdminCenterToastStore>((set) => ({
  toast: null,
  show: (text, ok = true) => set({ toast: { text, ok } }),
  hide: () => set({ toast: null }),
}));
