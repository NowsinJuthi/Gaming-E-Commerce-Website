import type { PaymentMethodValue } from "@/lib/api";

export type PaymentView = "all" | "paid" | "pending" | "failed" | "refunded";

export const ADMIN_PAYMENT_STATUS_STYLE: Record<string, string> = {
  pending: "dashboard-pro-status dashboard-pro-status--amber",
  paid: "dashboard-pro-status dashboard-pro-status--green",
  failed: "dashboard-pro-status dashboard-pro-status--amber",
  refunded: "dashboard-pro-status dashboard-pro-status--brand",
};

export const ADMIN_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export const ADMIN_PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  wallet: "Wallet",
  gateway: "Gateway",
  manual: "Manual / bank",
};

export const PAYMENT_STATUS_TABS: Array<{ id: PaymentView; label: string }> = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "refunded", label: "Refunded" },
];

export function formatAdminPaymentStatus(status: string | undefined): string {
  if (!status) return "Pending";
  return ADMIN_PAYMENT_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function formatAdminPaymentMethod(
  method: PaymentMethodValue | string | undefined,
): string {
  if (!method) return "—";
  return (
    ADMIN_PAYMENT_METHOD_LABELS[method as PaymentMethodValue] ?? method
  );
}

export function formatAdminPaymentDate(
  paidAt: string | undefined,
  createdAt: string | undefined,
): string {
  const value = paidAt ?? createdAt;
  if (!value) return "—";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "—";
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
