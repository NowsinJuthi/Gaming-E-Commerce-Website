"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { DashboardUnifiedHeader } from "@/components/customer/DashboardUnifiedHeader";
import { DashboardView } from "@/components/customer/DashboardView";
import {
  ApiError,
  clearTokens,
  getMe,
  hasRefreshToken,
  getOrderStats,
  getWallet,
  listOrders,
  type CustomerOrderStats,
  type OrderDetail,
  type UserProfile,
  type Wallet,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [orderStats, setOrderStats] = useState<CustomerOrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [me, w, o, stats] = await Promise.all([
          getMe(),
          getWallet().catch(() => null),
          listOrders(1, 50)
            .then((r) => r.items)
            .catch(() => []),
          getOrderStats().catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(me);
        setWallet(w);
        setOrders(o);
        setOrderStats(stats);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          if (!hasRefreshToken()) {
            clearTokens();
            router.replace("/login");
          }
          return;
        }
        if (err instanceof ApiError && err.status === 503) {
          setError(err.message);
          return;
        }
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const unifiedHeader = useMemo(() => {
    if (!profile) return null;
    return (
      <DashboardUnifiedHeader profile={profile} orders={orders} />
    );
  }, [profile, orders]);

  if (error) {
    return (
      <CustomerPageLayout
        section="Account"
        title="My Dashboard"
        description="Track orders, wallet balance, and account activity."
        iconKey="home"
        backHref="/products"
        backLabel="Store"
      >
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      </CustomerPageLayout>
    );
  }

  return (
    <CustomerPageLayout
      section="Account"
      title="My Dashboard"
      description="Track orders, wallet balance, and account activity."
      iconKey="home"
      backHref="/products"
      backLabel="Store"
      loading={loading || !profile}
      loadingText="Loading your dashboard…"
      unifiedHeader={unifiedHeader}
    >
      {profile ? (
        <DashboardView
          profile={profile}
          wallet={wallet}
          orders={orders}
          orderStats={orderStats}
        />
      ) : null}
    </CustomerPageLayout>
  );
}
