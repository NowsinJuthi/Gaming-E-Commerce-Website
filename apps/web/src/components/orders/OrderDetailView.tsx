"use client";

import { useMemo, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { OrderDeliveryCards } from "@/components/orders/OrderDeliveryCards";
import { OrderInfoPanels } from "@/components/orders/OrderInfoPanels";
import { OrderPaymentPanel } from "@/components/orders/OrderPaymentPanel";
import {
  BoxIcon,
  CheckIcon,
  CopyIcon,
  FileIcon,
  ReceiptIcon,
  TruckIcon,
  WalletIcon,
  ZapIcon,
} from "@/components/admin/icons";
import type { OrderDetail } from "@/lib/api";
import {
  CUSTOMER_ORDER_TRACKER_STEPS,
  customerOrderStatusLabel,
  customerOrderTrackerIndex,
} from "@/lib/customer-order-status";
import { dedupeConsecutiveTimelineEntries } from "@/lib/order-timeline";
import { orderLineQuantity } from "@/lib/admin-order-view";

const STATUS_STEPS = CUSTOMER_ORDER_TRACKER_STEPS;

const STEP_META: Record<
  (typeof STATUS_STEPS)[number],
  { label: string; Icon: typeof ReceiptIcon }
> = {
  pending: { label: "Pending", Icon: ReceiptIcon },
  paid: { label: "Paid", Icon: WalletIcon },
  processing: { label: "Processing", Icon: ZapIcon },
  delivered: { label: "Delivered", Icon: TruckIcon },
};

const STATUS_CLASS: Record<string, string> = {
  pending: "order-pro-status--amber",
  paid: "order-pro-status--brand",
  processing: "order-pro-status--brand",
  delivered: "order-pro-status--green",
  cancelled: "order-pro-status--rose",
  refunded: "order-pro-status--rose",
  failed: "order-pro-status--rose",
};

type Props = {
  order: OrderDetail;
  paying: boolean;
  message: string | null;
  onPay: () => void;
};

function OrderDeliveryTracking({
  activeIdx,
  className = "",
}: {
  activeIdx: number;
  className?: string;
}) {
  return (
    <section
      className={`order-pro-card order-pro-tracking ${className}`.trim()}
    >
      <div className="order-pro-tracking-inline">
        <header className="order-pro-tracking-meta">
          <span className="order-pro-section-icon">
            <TruckIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="order-pro-section-title">Delivery tracking</h2>
            <p className="order-pro-section-sub">
              Follow your order from payment to delivery
            </p>
          </div>
        </header>

        <div className="order-pro-steps">
          {STATUS_STEPS.map((step, i) => {
            const done = activeIdx >= 0 && i < activeIdx;
            const active = i === activeIdx;
            const isDeliveredStep =
              step === "delivered" && (done || active);
            const { label, Icon } = STEP_META[step];

            return (
              <span key={step} className="contents">
                {i > 0 ? (
                  <span
                    className={`order-pro-step-line${done || active ? " order-pro-step-line--on" : ""}`}
                    aria-hidden
                  />
                ) : null}
                <div
                  className={`order-pro-step${done ? " order-pro-step--done" : ""}${active ? " order-pro-step--active" : ""}${isDeliveredStep ? " order-pro-step--delivered-gold" : ""}`}
                >
                  <span className="order-pro-step-dot">
                    {done ? (
                      <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                    ) : active ? (
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="order-pro-step-label">{label}</span>
                </div>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function OrderDetailView({ order, paying, message, onPay }: Props) {
  const cancelled =
    order.status === "cancelled" ||
    order.status === "refunded" ||
    order.status === "failed";
  const activeIdx = customerOrderTrackerIndex(order.status);
  const items = order.items ?? [];
  const itemCount = items.reduce(
    (sum, it) => sum + orderLineQuantity(it.quantity),
    0,
  );
  const timeline = useMemo(
    () => dedupeConsecutiveTimelineEntries(order.timeline ?? []),
    [order.timeline],
  );
  const timelineEntries = useMemo(() => [...timeline].reverse(), [timeline]);
  const [copied, setCopied] = useState(false);

  async function copyOrderNumber() {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="order-page order-page--pro">
      {message ? (
        <div className="order-pro-alert order-pro-alert--error">{message}</div>
      ) : null}

      {cancelled ? (
        <div className="order-pro-alert order-pro-alert--warning">
          This order was {order.status}. Contact support if you need help.
        </div>
      ) : null}

      <div className="order-pro-body">
        <div className="order-pro-main">
          <header className="order-pro-header">
            <div className="order-pro-header-main">
              <div className="order-pro-title-row">
                <h1 className="order-pro-number">
                  Order No: {order.orderNumber}
                </h1>
                <button
                  type="button"
                  onClick={copyOrderNumber}
                  className={`order-pro-copy${copied ? " order-pro-copy--copied" : ""}`}
                  aria-label={
                    copied ? "Copied" : `Copy order number ${order.orderNumber}`
                  }
                  title={copied ? "Copied!" : "Copy order number"}
                >
                  {copied ? (
                    <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
                <span
                  className={`order-pro-status ${STATUS_CLASS[order.status] ?? ""}`}
                >
                  {customerOrderStatusLabel(order.status)}
                </span>
              </div>
              <p className="order-pro-meta">
                {order.createdAt
                  ? `Placed ${new Date(order.createdAt).toLocaleString()}`
                  : "Order placed"}
                <span aria-hidden> · </span>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </p>
            </div>
          </header>

          {!cancelled ? (
            <OrderDeliveryTracking
              activeIdx={activeIdx}
              className="order-pro-tracking--desktop"
            />
          ) : null}

          <ProductFormOrderCard
            className="admin-product-form-section order-items-card"
            iconClassName="order-items-section-icon-gold"
            icon={<BoxIcon className="h-4 w-4" aria-hidden />}
            title="Order items"
            subtitle={`${items.length} ${items.length === 1 ? "product" : "products"} · delivery codes and details`}
          >
            <OrderDeliveryCards
              items={items}
              giftCards={order.manualGiftCards}
              embedded
            />
          </ProductFormOrderCard>

          {order.status === "pending" ? (
            <div className="order-pro-card order-pro-pay">
              <div className="order-pay-inner">
                <div>
                  <p className="order-pro-pay-title">Awaiting payment</p>
                  <p className="order-pro-pay-sub">
                    Complete payment with your wallet to start delivery.
                  </p>
                </div>
                <ActionButton
                  disabled={paying}
                  loading={paying}
                  icon={WalletIcon}
                  onClick={onPay}
                  className="w-full sm:w-auto sm:shrink-0"
                >
                  {paying ? "Paying…" : "Pay with wallet"}
                </ActionButton>
              </div>
            </div>
          ) : null}

          <OrderInfoPanels order={order} />
        </div>

        <aside className="order-pro-aside">
          <OrderPaymentPanel order={order} />

          {!cancelled ? (
            <OrderDeliveryTracking
              activeIdx={activeIdx}
              className="order-pro-tracking--mobile-aside"
            />
          ) : null}

          <section className="order-pro-card order-pro-timeline-card">
            <header className="order-pro-section-head">
              <span className="order-pro-section-icon">
                <FileIcon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="order-pro-section-title">Activity timeline</h2>
                <p className="order-pro-section-sub">Order history</p>
              </div>
            </header>

            <ol className="order-timeline order-timeline--pro">
              {timelineEntries.map((t, i) => (
                <li key={i} className="order-timeline-item">
                  <span className="order-timeline-dot" aria-hidden />
                  <div className="min-w-0">
                    <p className="order-timeline-status">{t.status}</p>
                    <p className="order-timeline-date">
                      {new Date(t.at).toLocaleString()}
                    </p>
                    {t.note ? (
                      <p className="order-timeline-note">{t.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
