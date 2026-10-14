"use client";

import { CloseIcon } from "@/components/admin/icons";
import {
  useToastStore,
  type ToastVariant,
} from "@/stores/toast-store";

type VariantCfg = {
  icon: string;
  barColor: string;
  iconRing: string;
  iconText: string;
  label: string;
};

const VARIANT: Record<ToastVariant, VariantCfg> = {
  success: {
    icon: "✓",
    barColor: "bg-success",
    iconRing: "border-success/30 bg-success/10",
    iconText: "text-success",
    label: "Success",
  },
  error: {
    icon: "✕",
    barColor: "bg-danger",
    iconRing: "border-danger/30 bg-danger/10",
    iconText: "text-danger",
    label: "Error",
  },
  warning: {
    icon: "⚠",
    barColor: "bg-[#ff073a] shadow-[0_0_14px_#ff073a]",
    iconRing:
      "border-[#ff073a]/60 bg-[#ff073a]/12 shadow-[0_0_12px_rgb(255_7_58/0.65)]",
    iconText: "text-[#ff073a]",
    label: "Warning",
  },
  info: {
    icon: "ℹ",
    barColor: "bg-[rgb(var(--brand))]",
    iconRing: "border-[rgb(var(--brand)/0.3)] bg-[rgb(var(--brand)/0.1)]",
    iconText: "text-[rgb(var(--brand))]",
    label: "Notice",
  },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  const active = toasts.at(-1);
  if (!active) return null;
  const cfg = VARIANT[active.variant];

  return (
    <>
      {/* Backdrop — visual only; dismiss via OK button */}
      <div
        className="fixed inset-0 z-[9998] animate-fade-in bg-black/40 backdrop-blur-sm"
        aria-hidden
      />

      {/* Center popup */}
      <div
        className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center px-4"
        role="alertdialog"
        aria-live="assertive"
        aria-atomic="true"
        aria-label={cfg.label}
      >
        <div
          className="pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-border bg-elevated shadow-[var(--surface-shadow-xl)] animate-[popup-in_0.26s_cubic-bezier(0.34,1.56,0.64,1)_both]"
        >
          {/* Top accent stripe */}
          <div className={`h-[3px] w-full ${cfg.barColor}`} />

          <div className="px-6 py-5">
            {/* Icon + message row */}
            <div className="flex items-start gap-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${cfg.iconRing} ${cfg.iconText}`}
                aria-hidden
              >
                {cfg.icon}
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-[13px] font-semibold leading-snug text-foreground-muted uppercase tracking-wide mb-1">
                  {cfg.label}
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  {active.message}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between">
              {toasts.length > 1 ? (
                <span className="text-[11px] text-subtle">
                  +{toasts.length - 1} more
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => dismiss(active.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground"
              >
                <CloseIcon className="h-3.5 w-3.5" aria-hidden />
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
