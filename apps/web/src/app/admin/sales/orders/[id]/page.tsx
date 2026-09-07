"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { resolveVariationRegions } from "@/components/admin/product-variations";
import {
  parseCustomOrderFields,
  type CustomOrderField,
} from "@/components/admin/custom-order-fields-editor";
import {
  parseSavedDeliveryNotes,
  type SavedDeliveryNote,
} from "@/components/admin/saved-delivery-notes-editor";
import { AdminOrderDetailView } from "@/components/admin/orders/AdminOrderDetailView";
import { ReceiptIcon } from "@/components/admin/icons";
import {
  ADMIN_ORDER_STATUS_LABELS,
  formatAdminOrderRef,
} from "@/lib/admin-order-ui";
import {
  formatAdminOrderPlaced,
  getAdminLockDisplayName,
  mapCustomerOrderStats,
  normalizeOrderLineProductId,
  type AdminOrderCompletePayload,
} from "@/lib/admin-order-view";
import {
  adminGetCustomer,
  adminGetCustomerOrderStats,
  adminDeleteOrder,
  getCustomerPanelConfig,
  getDeliverySettings,
  getMe,
  getProduct,
  getOrder,
  saveOrderManualDelivery,
  sendOrderNote,
  updateOrderStatus,
  type AdminCustomerRow,
  type EmailSenderChannel,
  type OrderDetail,
  type OrderStatusValue,
} from "@/lib/api";
import { useOrderLock } from "@/hooks/useOrderLock";
import { useOnStoreEvent } from "@/hooks/useOnStoreEvent";

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [adminLockName, setAdminLockName] = useState<string | null>(null);
  useEffect(() => {
    getMe()
      .then((me) => setAdminLockName(getAdminLockDisplayName(me)))
      .catch(() => setAdminLockName("Staff"));
  }, []);

  const { lockState, forceOverride } = useOrderLock(id, {
    userName: adminLockName ?? "",
    enabled: Boolean(id) && adminLockName !== null,
  });

  // Notify when another salesperson force-takes the lock from us
  useOnStoreEvent("order.locked", (payload) => {
    if (payload.orderId === id && lockState.status === "acquired") {
      adminToast(`⚠️ ${payload.userName} just opened this order.`, false);
    }
  });

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [customer, setCustomer] = useState<AdminCustomerRow | null>(null);
  const [customerHistory, setCustomerHistory] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
  });
  const [productThumbs, setProductThumbs] = useState<Record<string, string>>(
    {},
  );
  const [productRegionsByLineKey, setProductRegionsByLineKey] = useState<
    Record<string, string[]>
  >({});
  const [productAttributesByProductId, setProductAttributesByProductId] =
    useState<Record<string, Record<string, unknown> | undefined>>({});
  const [productDeliveryTypeByProductId, setProductDeliveryTypeByProductId] =
    useState<Record<string, string | undefined>>({});
  const [statusDraft, setStatusDraft] = useState<OrderStatusValue>("processing");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deliveryFields, setDeliveryFields] = useState<CustomOrderField[]>([]);
  const [savedDeliveryNotes, setSavedDeliveryNotes] = useState<
    SavedDeliveryNote[]
  >([]);
  const [gatewayLabel, setGatewayLabel] = useState("bKash / Nagad");

  const refreshCustomerHistory = useCallback(async (userId: string) => {
    try {
      const stats = await adminGetCustomerOrderStats(userId);
      setCustomerHistory(mapCustomerOrderStats(stats));
    } catch {
      setCustomerHistory({
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
      });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let o: OrderDetail;
    try {
      // Fetch order, delivery settings, and checkout config in parallel
      const [fetchedOrder, settings, panelConfig] = await Promise.all([
        getOrder(id),
        getDeliverySettings().catch(() => null),
        getCustomerPanelConfig().catch(() => null),
      ]);
      o = fetchedOrder;
      setOrder(o);
      setStatusDraft(o.status);

      const label = panelConfig?.checkout?.gatewayLabel?.trim();
      if (label) setGatewayLabel(label);

      if (settings) {
        setDeliveryFields(parseCustomOrderFields(settings.customOrderFields));
        setSavedDeliveryNotes(
          parseSavedDeliveryNotes(settings.savedDeliveryNotes ?? []),
        );
      } else {
        setDeliveryFields([]);
        setSavedDeliveryNotes([]);
      }
    } catch {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      const [customerRow] = await Promise.all([
        adminGetCustomer(o.userId).catch(() => null),
        refreshCustomerHistory(o.userId),
      ]);

      setCustomer(customerRow);

      const thumbs: Record<string, string> = {};
      const regionsByLineKey: Record<string, string[]> = {};
      const attributesByProductId: Record<
        string,
        Record<string, unknown> | undefined
      > = {};
      const deliveryTypeByProductId: Record<string, string | undefined> = {};
      await Promise.all(
        (o.items ?? []).map(async (item) => {
          const productId = normalizeOrderLineProductId(item.productId);
          const lineKey = `${productId}::${item.variationValueId ?? ""}`;
          if (attributesByProductId[productId] !== undefined) {
            return;
          }
          try {
            const product = await getProduct(item.slug);
            if (!product) return;
            attributesByProductId[productId] = product.attributes;
            deliveryTypeByProductId[productId] = product.deliveryType;
            const url = product.media?.[0]?.url;
            if (url) thumbs[productId] = url;
            const regions = resolveVariationRegions(
              product.attributes,
              item.variationValueId,
              product.availableRegions,
            );
            if (regions.length) {
              regionsByLineKey[lineKey] = regions;
            }
          } catch {
            attributesByProductId[productId] = {};
          }
        }),
      );
      setProductThumbs(thumbs);
      setProductRegionsByLineKey(regionsByLineKey);
      setProductAttributesByProductId(attributesByProductId);
      setProductDeliveryTypeByProductId(deliveryTypeByProductId);
    } catch {
      setDeliveryFields([]);
      setSavedDeliveryNotes([]);
    } finally {
      setLoading(false);
    }
  }, [id, refreshCustomerHistory]);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeOrder(payload: AdminOrderCompletePayload) {
    if (!order) return;
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await updateOrderStatus(
        order._id,
        "delivered",
        undefined,
        payload.deliveryMessage,
        payload.emailChannel,
        payload.giftCards,
      );
      setOrder(updated);
      setStatusDraft(updated.status);
      void refreshCustomerHistory(updated.userId);
      adminToast(
        payload.deliveryMessage || payload.giftCards.length > 0
          ? "Order completed. Delivery saved and sent to the customer."
          : "Order marked complete.",
        true,
      );
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function saveManualDelivery(
    payload: Pick<AdminOrderCompletePayload, "deliveryMessage" | "giftCards">,
  ) {
    if (!order) return;
    if (payload.giftCards.length === 0 && !payload.deliveryMessage?.trim()) {
      adminToast("Add at least one gift card code or a customer note before saving.", false);
      return;
    }
    setBusy(true);
    hideAdminToast();
    // Destructure to guarantee only the whitelisted fields reach the API.
    const { giftCards, deliveryMessage } = payload;
    try {
      const updated = await saveOrderManualDelivery(order._id, { giftCards, deliveryMessage });
      setOrder(updated);
      adminToast("Manual delivery saved. Complete the order to email the customer.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not save delivery", false);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendNote(
    message: string,
    emailChannel: EmailSenderChannel,
  ) {
    if (!order) return;
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await sendOrderNote(order._id, message, emailChannel);
      setOrder(updated);
      adminToast("Note sent to customer.", true);
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Could not send note",
        false,
      );
    } finally {
      setBusy(false);
    }
  }

  async function applyStatus(status: OrderStatusValue) {
    if (!order) return;
    if (status === "refunded" && order.status !== "refunded") {
      if (
        !window.confirm(
          `Refund order ${order.orderNumber}? Wallet credit will be issued and this cannot be undone.`,
        )
      ) {
        setStatusDraft(order.status);
        return;
      }
    }
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await updateOrderStatus(order._id, status);
      setOrder(updated);
      setStatusDraft(updated.status);
      void refreshCustomerHistory(updated.userId);
      const label =
        status === "failed"
          ? "Order moved to trash."
          : status === "refunded"
            ? "Order refunded."
            : `Status updated to ${ADMIN_ORDER_STATUS_LABELS[status] ?? status}.`;
      adminToast(label, true);
    } catch (err) {
      setStatusDraft(order.status);
      adminToast(err instanceof Error ? err.message : "Update failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function onMoveToTrash() {
    if (!order) return;
    if (
      !window.confirm(
        `Move order ${order.orderNumber} to trash?`,
      )
    ) {
      return;
    }
    await applyStatus("failed");
  }

  async function onTrash() {
    if (!order) return;
    if (
      !window.confirm(
        `Permanently delete order ${order.orderNumber}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      await adminDeleteOrder(order._id);
      adminToast("Order deleted.", true);
      router.push("/admin/sales/orders");
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Delete failed", false);
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !order) {
    return (
      <AdminPageLayout
        section="Sales"
        title="Order"
        backHref="/admin/sales/orders"
        backLabel="Back to orders"
      >
        <div className="dashboard-pro-empty py-10">
          <p className="text-foreground-muted">Order not found.</p>
          <Link href="/admin/sales/orders" className="btn-primary btn-primary-sm mt-4">
            Back to orders
          </Link>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      section="Sales"
      icon={ReceiptIcon}
      heroImageUrl={customer?.profile?.avatarUrl}
      title={order ? formatAdminOrderRef(order.orderNumber) : "Order"}
      description={
        order
          ? `Placed ${formatAdminOrderPlaced(order.createdAt)} · ${ADMIN_ORDER_STATUS_LABELS[order.status] ?? order.status}`
          : undefined
      }
      backHref="/admin/sales/orders"
      backLabel="Back to orders"
      loading={loading || !order}
      loadingText="Loading order…"
    >
      {/* Lock warning — blocks editing if another salesperson is on this order */}
      {lockState.status === "blocked" && (
        <OrderLockWarning
          lockedBy={lockState.lock.userName}
          lockedAt={lockState.lock.lockedAt}
          onGoBack={() => router.push("/admin/sales/orders")}
          onOverride={forceOverride}
        />
      )}

      {lockState.status === "error" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300">
          ⚠️ {lockState.message}
        </div>
      )}

      {lockState.status === "acquired" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-600/30 dark:bg-emerald-900/20 dark:text-emerald-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          You are editing this order. It is locked for other salespeople.
        </div>
      )}

      {order ? (
        <AdminOrderDetailView
          order={order}
          customer={customer}
          customerHistory={customerHistory}
          productThumbs={productThumbs}
          productRegionsByLineKey={productRegionsByLineKey}
          productAttributesByProductId={productAttributesByProductId}
          productDeliveryTypeByProductId={productDeliveryTypeByProductId}
          deliveryFields={deliveryFields}
          savedDeliveryNotes={savedDeliveryNotes}
          statusDraft={statusDraft}
          onStatusDraftChange={setStatusDraft}
          onUpdateStatus={() => applyStatus(statusDraft)}
          onMoveToTrash={() => void onMoveToTrash()}
          onTrash={() => void onTrash()}
          onSaveManualDelivery={saveManualDelivery}
          onCompleteOrder={completeOrder}
          onSendNote={handleSendNote}
          busy={busy}
          gatewayLabel={gatewayLabel}
        />
      ) : null}
    </AdminPageLayout>
  );
}

// ── Order lock warning modal ───────────────────────────────────────────────

function formatLockAge(lockedAt: string): string {
  const diff = Date.now() - new Date(lockedAt).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  return `${mins} minutes ago`;
}

function OrderLockWarning({
  lockedBy,
  lockedAt,
  onGoBack,
  onOverride,
}: {
  lockedBy: string;
  lockedAt: string;
  onGoBack: () => void;
  onOverride: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <LockIcon />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">Order is locked</h2>
            <p className="text-xs text-foreground-muted">
              Another salesperson is currently editing this order
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-900/20">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              {lockedBy}
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              Opened {formatLockAge(lockedAt)}
            </p>
          </div>

          <p className="mt-4 text-sm text-foreground-muted">
            To avoid conflicts, only one person can edit an order at a time. You
            can go back and wait, or override the lock to take over editing.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onGoBack}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-hover"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onOverride}
            className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            Override &amp; edit
          </button>
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
