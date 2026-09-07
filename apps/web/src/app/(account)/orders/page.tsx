"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerOrdersView } from "@/components/customer/CustomerOrdersView";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { ApiError, clearTokens, listOrders, type OrderDetail } from "@/lib/api";

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOrders(1, 50)
      .then((r) => {
        if (!cancelled) setOrders(r.items);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          if (!localStorage.getItem("refreshToken")) {
            clearTokens();
            router.replace("/login");
          }
          return;
        }
        if (err instanceof ApiError && err.status === 503) {
          setError(err.message);
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load orders");
        setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <CustomerPageLayout
        section=""
        title="My Order history"
        iconKey="orders"
        backHref="/dashboard"
        backLabel="Dashboard"
        heroClassName="customer-order-history-hero"
      >
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      </CustomerPageLayout>
    );
  }

  return (
    <CustomerPageLayout
      section=""
      title="My Order history"
      iconKey="orders"
      backHref="/dashboard"
      backLabel="Dashboard"
      heroClassName="customer-order-history-hero"
      loading={loading}
      loadingText="Loading orders…"
    >
      <CustomerOrdersView orders={orders} />
    </CustomerPageLayout>
  );
}
