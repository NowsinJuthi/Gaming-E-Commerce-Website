import type { OrderStatusValue, PaymentMethodValue } from "@/lib/api";

export const ADMIN_ORDER_STATUS_STYLE: Record<string, string> = {
  pending: "panel-3d-badge-amber",
  paid: "admin-order-badge-processing",
  processing: "admin-order-badge-processing",
  delivered: "admin-order-badge-completed",
  cancelled: "admin-order-badge-muted",
  refunded: "admin-order-badge-refunded",
  failed: "admin-order-badge-muted",
};

export const ADMIN_ORDER_DETAIL_STATUS_STYLE: Record<string, string> = {
  pending: "dashboard-pro-status dashboard-pro-status--amber",
  paid: "dashboard-pro-status dashboard-pro-status--amber",
  processing: "dashboard-pro-status dashboard-pro-status--amber",
  delivered: "dashboard-pro-status dashboard-pro-status--green",
  cancelled: "dashboard-pro-status dashboard-pro-status--brand",
  refunded: "dashboard-pro-status dashboard-pro-status--brand",
  failed: "dashboard-pro-status dashboard-pro-status--brand",
};

export const ADMIN_ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  pending: "Pending",
  paid: "Paid",
  processing: "Processing",
  delivered: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Trash",
};

export const ADMIN_REFUNDABLE_STATUSES = ["paid", "processing", "delivered"];

export function formatAdminOrderRef(orderNumber?: string | null): string {
  if (!orderNumber) return "—";
  return orderNumber.startsWith("#") ? orderNumber : `#${orderNumber}`;
}

export function adminOrderOrigin(method: PaymentMethodValue): string {
  if (method === "manual") return "Manual checkout";
  if (method === "wallet") return "Wallet";
  return "Direct"; // gateway and any future methods
}

export function formatAdminOrderWhen(createdAt?: string): string {
  if (!createdAt) return "—";
  const at = new Date(createdAt);
  return at.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
