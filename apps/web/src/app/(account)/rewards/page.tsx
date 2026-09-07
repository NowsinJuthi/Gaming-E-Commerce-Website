"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { RewardsView } from "@/components/customer/RewardsView";
import { formatPrice, getRewardsSummary, type RewardsSummary } from "@/lib/api";

export default function RewardsPage() {
  const [data, setData] = useState<RewardsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getRewardsSummary()
      .then((summary) => {
        if (!cancelled) setData(summary);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoadError("Could not load rewards.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const headerAction = useMemo(() => {
    if (!data || !data.enabled) return null;

    const ptsToRedeem = Math.max(0, data.redeemThreshold - data.points);

    return (
      <div className="flex flex-wrap justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--brand">
          {data.points.toLocaleString()} pts
        </span>
        {data.canRedeem ? (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            Ready to redeem
          </span>
        ) : (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            {ptsToRedeem} pts to redeem
          </span>
        )}
        <span className="dashboard-pro-status">
          {data.pointsPerCurrency} pt per {formatPrice(1, "BDT")}
        </span>
      </div>
    );
  }, [data]);

  return (
    <CustomerPageLayout
      section="Account"
      title="Rewards"
      description="Earn loyalty points on delivered orders."
      iconKey="rewards"
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading}
      loadingText="Loading rewards…"
      action={loading ? null : headerAction}
    >
      <RewardsView data={data} loadError={loadError} />
    </CustomerPageLayout>
  );
}
