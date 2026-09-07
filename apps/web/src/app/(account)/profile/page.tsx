"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { ProfilePageHeader } from "@/components/customer/ProfilePageHeader";
import { ProfileView } from "@/components/customer/ProfileView";
import {
  isSettingsTab,
  type SettingsTab,
} from "@/lib/account-settings-tabs";
import { getMe, getOrderStats, getWallet, listOrders, type CustomerOrderStats, type OrderDetail, type UserProfile, type Wallet } from "@/lib/api";

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<SettingsTab>(
    initialTab && isSettingsTab(initialTab) ? initialTab : "profile",
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [orderStats, setOrderStats] = useState<CustomerOrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab && isSettingsTab(nextTab)) {
      setTab(nextTab);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getMe()
      .then(async (me) => {
        if (cancelled) return;
        setProfile(me);
        const [w, o, stats] = await Promise.all([
          getWallet().catch(() => null),
          listOrders(1, 50)
            .then((r) => r.items)
            .catch(() => []),
          getOrderStats().catch(() => null),
        ]);
        if (cancelled) return;
        setWallet(w);
        setOrders(o);
        setOrderStats(stats);
      })
      .catch((e) => {
        if (!cancelled) {
          setProfile(null);
          setLoadError(
            e instanceof Error ? e.message : "Could not load profile.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshProfile = () => {
      getMe()
        .then((me) => setProfile(me))
        .catch(() => {});
    };
    window.addEventListener("auth-change", refreshProfile);
    return () => window.removeEventListener("auth-change", refreshProfile);
  }, []);

  const profileHeader = useMemo(
    () => (
      <div className="lg:hidden">
        <ProfilePageHeader profile={profile} loading={loading} />
      </div>
    ),
    [profile, loading],
  );

  return (
    <CustomerPageLayout
      section=""
      title=""
      iconKey="profile"
      unifiedHeader={profileHeader}
      loading={loading && !loadError}
      loadingText="Loading profile…"
    >
      <ProfileView
        profile={profile}
        wallet={wallet}
        orders={orders}
        orderStats={orderStats}
        loading={loading}
        loadError={loadError}
        tab={tab}
        onTabChange={setTab}
      />
    </CustomerPageLayout>
  );
}
