"use client";

import { useEffect, useMemo, useState } from "react";
import { PriceText } from "@/components/ui/PriceText";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { ReferralView } from "@/components/customer/ReferralView";
import { getAffiliateDashboard, type AffiliateDashboard } from "@/lib/api";

export default function ReferralPage() {
  const [dash, setDash] = useState<AffiliateDashboard | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAffiliateDashboard()
      .then((data) => {
        if (!cancelled) setDash(data);
      })
      .catch(() => {
        if (!cancelled) setDash(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy() {
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
      title="Referral"
      description="Invite friends and earn when they shop."
      iconKey="referral"
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading}
      loadingText="Loading referral…"
      action={loading ? null : headerAction}
    >
      <ReferralView dash={dash} copied={copied} onCopy={() => void copy()} />
    </CustomerPageLayout>
  );
}
