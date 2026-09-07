"use client";

import { useEffect } from "react";
import { useAdminCenterToastStore } from "@/stores/admin-center-toast-store";

const AUTO_DISMISS_MS = 4000;

export function AdminCenterToast() {
  const toast = useAdminCenterToastStore((s) => s.toast);
  const hide = useAdminCenterToastStore((s) => s.hide);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(hide, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast, hide]);

  useEffect(() => {
    if (!toast) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toast, hide]);

  if (!toast) return null;

  return (
    <div
      className="admin-center-toast-overlay"
      role="presentation"
      onClick={hide}
    >
      <div
        role="alertdialog"
        aria-live="assertive"
        aria-modal="true"
        className={`admin-center-toast ${
          toast.ok
            ? "admin-center-toast--success"
            : "admin-center-toast--error"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="admin-center-toast-icon" aria-hidden>
          {toast.ok ? "✓" : "✕"}
        </span>
        <p className="admin-center-toast-text">{toast.text}</p>
        <button type="button" className="admin-center-toast-btn" onClick={hide}>
          OK
        </button>
      </div>
    </div>
  );
}
