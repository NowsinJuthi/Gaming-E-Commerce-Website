"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { OrderDetailView } from "@/components/orders/OrderDetailView";
import { getOrder, payOrder, type OrderDetail } from "@/lib/api";

function orderPollSignature(order: OrderDetail): string {
  const timeline = order.timeline ?? [];
  const items = order.items ?? [];
  return [
    order.status,
    order.payment?.status ?? "",
    order.payment?.paidAt ?? "",
    timeline.length,
    timeline.at(-1)?.at ?? "",
    items
      .map(
        (item) =>
          `${item.delivered}:${item.deliveredCodes?.map((code) => code.code).join("|") ?? ""}`,
      )
      .join(";"),
    order.manualGiftCards
      ?.map((card) => `${card.code ?? ""}:${card.amount ?? ""}`)
      .join("|") ?? "",
    order.pricing?.total ?? 0,
  ].join("::");
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshOrder = useCallback(async () => {
    try {
      const o = await getOrder(id);
      setOrder((prev) => {
        if (prev && orderPollSignature(prev) === orderPollSignature(o)) {
          return prev;
        }
        return o;
      });
    } catch {
      /* keep last known order during polling blips */
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOrder(id)
      .then((o) => {
        if (!cancelled) setOrder(o);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const active =
      order &&
      (order.status === "paid" || order.status === "processing");

    function startPolling() {
      if (!active || timer.current || document.hidden) return;
      timer.current = setInterval(() => {
        if (!document.hidden) void refreshOrder();
      }, 5000);
    }

    function stopPolling() {
      if (!timer.current) return;
      clearInterval(timer.current);
      timer.current = null;
    }

    function syncPolling() {
      if (!active || document.hidden) {
        stopPolling();
        return;
      }
      startPolling();
    }

    syncPolling();
    document.addEventListener("visibilitychange", syncPolling);

    return () => {
      document.removeEventListener("visibilitychange", syncPolling);
      stopPolling();
    };
  }, [order, refreshOrder]);

  async function onPay() {
    setPaying(true);
    setMsg(null);
    try {
      const updated = await payOrder(id);
      setOrder(updated);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  if (!loading && !order) {
    return (
      <CustomerPageLayout
        iconKey="orders"
        title="Order"
        backHref="/orders"
        backLabel="My Order history"
      >
        <div className="shell-panel border-dashed p-10 text-center">
          <p className="text-sm text-foreground-muted">Order not found.</p>
          <Link href="/orders" className="btn-primary mt-4 inline-flex">
            Back to orders
          </Link>
        </div>
      </CustomerPageLayout>
    );
  }

  if (loading || !order) {
    return (
      <div className="order-page order-page--pro">
        <p className="order-pro-loading">Loading order…</p>
      </div>
    );
  }

  return (
    <OrderDetailView
      order={order}
      paying={paying}
      message={msg}
      onPay={onPay}
    />
  );
}
