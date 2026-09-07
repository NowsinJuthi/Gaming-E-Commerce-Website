"use client";

import { useEffect, useMemo, useState } from "react";
import { PriceText } from "@/components/ui/PriceText";
import { AffiliateView } from "@/components/customer/AffiliateView";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import {
  getAffiliateDashboard,
  listMyAffiliateCommissions,
  type AffiliateCommission,
  type AffiliateDashboard,
} from "@/lib/api";

export default function AffiliateDashboardPage() {
  const [dash, setDash] = useState<AffiliateDashboard | null>(null);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getAffiliateDashboard(),
      listMyAffiliateCommissions({ limit: 50 }),
    ])
      .then(([d, c]) => {
        if (cancelled) return;
        setDash(d);
        setCommissions(c.items);
      })
      .catch(() => {
        if (!cancelled) {
          setDash(null);
          setCommissions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyLink() {
    if (!dash?.referralLink) return;
    await navigator.clipboard.writeText(dash.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const headerAction = useMemo(() => {
    if (!dash) return null;
    const affiliate = dash.affiliate;
    const ratePct = Math.round(affiliate.commissionRate * 100);

    return (
      <div className="flex flex-wrap justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--brand">
          {dash.referralCode}
        </span>
        <span className="dashboard-pro-status dashboard-pro-status--green">
          {ratePct}% commission
        </span>
        <span
          className={`dashboard-pro-status capitalize ${
            affiliate.status === "active"
              ? "dashboard-pro-status--green"
              : ""
          }`}
        >
          {affiliate.status}
        </span>
        {(affiliate.totalPending ?? 0) > 0 ? (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            Pending{" "}
            <PriceText amount={affiliate.totalPending} currency="BDT" />
          </span>
        ) : null}
      </div>
    );
  }, [dash]);

  return (
    <CustomerPageLayout
      section="Account"
      title="Affiliate program"
      description="Share your link, earn commission on referred orders."
      iconKey="affiliate"
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading}
      loadingText="Loading affiliate dashboard…"
      action={loading ? null : headerAction}
    >
      <AffiliateView
        dash={dash}
        commissions={commissions}
        copied={copied}
        onCopy={() => void copyLink()}
      />
    </CustomerPageLayout>
  );
}
