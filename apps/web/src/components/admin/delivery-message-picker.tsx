"use client";

import { AdminSelect } from "@/components/admin/AdminSelect";

export type DeliveryMessageOption = {
  id: string;
  templateLabel: string;
  message: string;
};

type DeliveryMessagePickerProps = {
  open: boolean;
  orderLabel?: string;
  options: DeliveryMessageOption[];
  value: string;
  onChange: (message: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
};

export function DeliveryMessagePicker({
  open,
  orderLabel,
  options,
  value,
  onChange,
  onCancel,
  onConfirm,
  busy = false,
}: DeliveryMessagePickerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/55"
        onClick={onCancel}
        aria-hidden
      />
      <div className="admin-product-form-section shell-panel relative z-10 w-full max-w-lg p-5 md:p-6">
        <h3 className="text-sm font-semibold text-foreground">
          Select delivery message
        </h3>
        <p className="mt-1 text-xs text-subtle">
          {orderLabel
            ? `Choose a preset message to send to the customer when ${orderLabel} is marked complete.`
            : "Choose a preset message to send to customers when orders are marked complete."}
        </p>

        {options.length === 0 ? (
          <p className="mt-4 text-sm text-amber-300">
            No delivery messages configured. Add templates in Settings → Auto
            delivery first.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="admin-filter-label">Message</label>
            <AdminSelect
              value={value}
              onChange={onChange}
              className="w-full"
              options={[
                { value: "", label: "Select a message…" },
                ...options.map((opt) => ({
                  value: opt.message,
                  label: `${opt.templateLabel}: ${opt.message.slice(0, 72)}${
                    opt.message.length > 72 ? "…" : ""
                  }`,
                })),
              ]}
            />
            {value ? (
              <div className="admin-product-form-subpanel rounded-xl border border-border bg-sunken p-3 text-sm text-foreground-muted">
                {value}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="dashboard-pro-btn-ghost"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !value || options.length === 0}
            className="btn-primary btn-primary-sm disabled:opacity-50"
          >
            {busy ? "Completing…" : "Mark complete & send"}
          </button>
        </div>
      </div>
    </div>
  );
}
