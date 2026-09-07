"use client";

import { ReceiptIcon } from "@/components/admin/icons";
import { PriceText } from "@/components/ui/PriceText";
import type { Voucher } from "@/lib/api";

type CardTone = "success" | "amber" | "processing" | "muted";

const STATUS_META: Record<
  string,
  { label: string; tone: CardTone; badgeTone: CardTone }
> = {
  active: { label: "Active", tone: "success", badgeTone: "success" },
  redeemed: { label: "Redeemed", tone: "processing", badgeTone: "processing" },
  expired: { label: "Expired", tone: "amber", badgeTone: "amber" },
};

const FALLBACK_STATUS_META: {
  label: string;
  tone: CardTone;
  badgeTone: CardTone;
} = {
  label: "Expired",
  tone: "amber",
  badgeTone: "amber",
};

function formatAssignedUserId(value: unknown): string {
  if (value == null) return "Any customer";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "Any customer";
  }
  if (typeof value === "object") {
    const record = value as { _id?: unknown; toString?: () => string };
    if (record._id != null) return String(record._id);
    if (typeof record.toString === "function") {
      const asString = record.toString();
      if (asString && asString !== "[object Object]") return asString;
    }
  }
  return String(value);
}

function formatVoucherExpiry(expiresAt?: string): string {
  if (!expiresAt) return "No expiry";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Props = {
  voucher: Voucher;
  status: "active" | "redeemed" | "expired";
  onDelete: () => void;
  deleting?: boolean;
  disabled?: boolean;
};

export function AdminVoucherCard({
  voucher,
  status,
  onDelete,
  deleting = false,
  disabled = false,
}: Props) {
  const meta = STATUS_META[status] ?? FALLBACK_STATUS_META;
  const assigned = formatAssignedUserId(voucher.assignedUserId);
  const expiry = formatVoucherExpiry(voucher.expiresAt);

  return (
    <article
      className={`admin-product-card admin-voucher-card dashboard-recent-order dashboard-recent-order--${meta.tone}`}
    >
      <span className="dashboard-recent-order-accent" aria-hidden />

      <div className="dashboard-recent-order-inner">
        <div className="dashboard-recent-order-main">
          <span className="dashboard-recent-order-icon" aria-hidden>
            <ReceiptIcon className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="dashboard-recent-order-header">
              <div className="dashboard-recent-order-title-block min-w-0">
                <p className="dashboard-recent-order-title">
                  <span className="font-mono text-brand">{voucher.code}</span>
                </p>
                <p className="dashboard-recent-order-meta">
                  <PriceText amount={voucher.amount} currency={voucher.currency} />
                  {" · Assigned "}
                  <span className="font-mono text-[10px] uppercase tracking-wide">
                    {assigned}
                  </span>
                  {" · Expires "}
                  {expiry}
                </p>
              </div>
              <span
                className={`dashboard-recent-order-badge dashboard-recent-order-badge--${meta.badgeTone}`}
              >
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        <div className="dashboard-recent-order-actions">
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled || deleting}
            className="dashboard-recent-order-view text-rose-300 hover:text-rose-200 disabled:opacity-40"
          >
            <span className="dashboard-recent-order-view-label">
              {deleting ? "Deleting…" : "Delete"}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
