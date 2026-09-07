"use client";

import { useAdminCenterToastStore } from "@/stores/admin-center-toast-store";

export function AppearanceToast() {
  const toast = useAdminCenterToastStore((state) => state.toast);
  if (!toast) return null;

  return (
    <div
      className={`admin-appearance-toast rounded-xl border px-4 py-3 text-sm ${
        toast.ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
      }`}
    >
      {toast.text}
    </div>
  );
}
