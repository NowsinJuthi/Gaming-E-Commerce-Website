"use client";

import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
};

type ToastState = {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
};

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = "info", duration = 0) => {
    const id = `toast-${++counter}`;
    set((s) => ({
      toasts: [...s.toasts, { id, message, variant, duration }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(
  message: string,
  variant: ToastVariant = "info",
  duration?: number,
) {
  useToastStore.getState().push(message, variant, duration);
}
