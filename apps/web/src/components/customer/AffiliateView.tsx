"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PriceText } from "@/components/ui/PriceText";
import {
  AdminOrderListCard,
  AdminOrderPageIntro,
  AdminOrderStatField,
  AdminOrderStatsGrid,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import {
  ChartIcon,
  CheckIcon,
  DollarIcon,
  GridIcon,
  LinkIcon,
  PulseIcon,
  ReceiptIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  type AffiliateCommission,
  type AffiliateCommissionStatus,
  type AffiliateDashboard,
} from "@/lib/api";
import { AFFILIATE_QUICK_LINKS } from "@/lib/customer-quick-links";

type Props = {
  dash: AffiliateDashboard | null;
  commissions: AffiliateCommission[];
  copied: boolean;
  onCopy: () => void;
};

function commissionStatusClass(status: AffiliateCommissionStatus) {
  switch (status) {
    case "paid":
      return "dashboard-pro-status dashboard-pro-status--green";
    case "pending":
      return "dashboard-pro-status dashboard-pro-status--amber";
    default:
      return "dashboard-pro-status";
  }
}

export function AffiliateView({ dash, commissions, copied, onCopy }: Props) {
  const affiliate = dash?.affiliate ?? null;
  const ratePct = affiliate ? Math.round(affiliate.commissionRate * 100) : 0;

  const { paidCount, pendingCount } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    for (const c of commissions) {
      if (c.status === "paid") paid += 1;
      else if (c.status === "pending") pending += 1;
    }
    return { paidCount: paid, pendingCount: pending };
  }, [commissions]);

  const introSubtitle = dash
    ? `Code ${dash.referralCode} · ${ratePct}% commission · ${commissions.length} recorded commissions`
    : "Share your link and earn commission on referred orders";

  if (!dash || !affiliate) {
    return (
      <>
        <AdminOrderPageIntro
          icon={<ChartIcon className="h-4 w-4" />}
          title="Affiliate program"
          subtitle="Affiliate dashboard is not available yet"
          quickLinks={AFFILIATE_QUICK_LINKS}
          quickNavLabel="Account shortcuts"
        />

        <AdminOrderTwoColumnLayout
          main={
            <AdminOrderListCard
              icon={<ChartIcon className="h-4 w-4" />}
              title="Affiliate program"
              subtitle="Earn commission when friends shop through your link"
            >
              <div className="dashboard-pro-empty py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <GridIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Could not load affiliate program
                </p>
                <p className="mt-1 text-xs text-subtle">
                  The affiliate program may not be enabled for your account yet.
                  Try again later or contact support.
                </p>
                <Link href="/referral" className="dashboard-pro-btn mt-4">
                  Open referral page
                </Link>
              </div>
            </AdminOrderListCard>
          }
          sidebar={
            <ProductFormOrderCard
              icon={<SettingsIcon className="h-4 w-4" />}
              title="Need help?"
              subtitle="Affiliate program support"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Support</dt>
                <dd className="space-y-3 text-sm text-foreground-muted">
                  <p>
                    Questions about affiliate earnings or payouts? Contact
                    support for assistance.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/chat" className="dashboard-pro-btn text-xs">
                      Live chat
                    </Link>
                    <Link
                      href="/support"
                      className="dashboard-pro-btn-ghost text-xs"
                    >
                      Support center
                    </Link>
                  </div>
                </dd>
              </div>
            </ProductFormOrderCard>
          }
        />
      </>
    );
  }

  return (
    <>
      <AdminOrderPageIntro
        icon={<ChartIcon className="h-4 w-4" />}
        title="Affiliate program"
        subtitle={introSubtitle}
        quickLinks={AFFILIATE_QUICK_LINKS}
        quickNavLabel="Account shortcuts"
      />

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<ChartIcon className="h-4 w-4" />}
              title="Affiliate overview"
              subtitle={`${affiliate.clicks} clicks · ${affiliate.signups} signups · ${affiliate.conversions} conversions`}
            >
              <AdminOrderStatsGrid>
                <AdminOrderStatField
                  icon={<PulseIcon className="h-4 w-4" />}
                  label="Link clicks"
                  value={affiliate.clicks.toLocaleString()}
                  meta="Referral link visits"
                />
                <AdminOrderStatField
                  icon={<UsersIcon className="h-4 w-4" />}
                  label="Signups"
                  value={affiliate.signups.toLocaleString()}
                  meta="Referred registrations"
                />
                <AdminOrderStatField
                  icon={<CheckIcon className="h-4 w-4" />}
                  label="Conversions"
                  value={affiliate.conversions.toLocaleString()}
                  meta="Completed referred orders"
                />
                <AdminOrderStatField
                  icon={<DollarIcon className="h-4 w-4" />}
                  label="Total earned"
                  value={
                    <PriceText amount={affiliate.totalEarned} currency="BDT" />
                  }
                  meta="Approved commissions"
                />
              </AdminOrderStatsGrid>

              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-4 text-xs text-foreground-muted">
                <span>
                  <span className="font-semibold text-foreground">Pending</span>{" "}
                  <PriceText amount={affiliate.totalPending} currency="BDT" />
                </span>
                <span>
                  <span className="font-semibold text-foreground">Rate</span>{" "}
                  {ratePct}%
                </span>
                <span>
                  <span className="font-semibold text-foreground">Status</span>{" "}
                  <span className="capitalize">{affiliate.status}</span>
                </span>
                <span>
                  <span className="font-semibold text-foreground">
                    Commissions
                  </span>{" "}
                  {commissions.length}
                </span>
              </div>

              {(affiliate.totalPending ?? 0) > 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                  Pending payout:{" "}
                  <strong>
                    <PriceText
                      amount={affiliate.totalPending}
                      currency="BDT"
                    />
                  </strong>{" "}
                  — approved by admin, then credited to your wallet.
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Link href="/referral" className="dashboard-pro-btn-ghost text-xs">
                  Referral page
                </Link>
                <Link href="/wallet" className="dashboard-pro-btn-ghost text-xs">
                  Wallet
                </Link>
                <Link href="/rewards" className="dashboard-pro-btn-ghost text-xs">
                  Rewards
                </Link>
              </div>
            </AdminOrderListCard>

            <AdminOrderListCard
              icon={<ReceiptIcon className="h-4 w-4" />}
              title="Commission history"
              subtitle={
                commissions.length > 0
                  ? `${paidCount} paid · ${pendingCount} pending`
                  : "Earnings from referred orders"
              }
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Commissions</dt>
                <dd>
                  {commissions.length === 0 ? (
                    <div className="dashboard-pro-empty py-8">
                      <span className="dashboard-pro-empty-icon" aria-hidden>
                        <GridIcon className="h-6 w-6" />
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        No commissions yet
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        Share your referral link to start earning commission on
                        referred orders.
                      </p>
                      <button
                        type="button"
                        onClick={onCopy}
                        className="dashboard-pro-btn mt-4 text-xs"
                      >
                        {copied ? "Copied!" : "Copy referral link"}
                      </button>
                    </div>
                  ) : (
                    <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                      <table className="panel-3d-table w-full text-sm">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Base</th>
                            <th>Commission</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commissions.map((c) => (
                            <tr key={c._id} className="text-foreground-muted">
                              <td className="font-mono text-xs">
                                …{c.orderId.slice(-8)}
                              </td>
                              <td>
                                <PriceText
                                  amount={c.baseAmount}
                                  currency={c.currency}
                                />
                              </td>
                              <td className="font-medium text-foreground">
                                <PriceText
                                  amount={c.amount}
                                  currency={c.currency}
                                />
                                <span className="ml-1 text-xs font-normal text-foreground-muted">
                                  ({Math.round(c.rate * 100)}%)
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`${commissionStatusClass(c.status)} capitalize`}
                                >
                                  {c.status}
                                </span>
                              </td>
                              <td className="whitespace-nowrap">
                                {c.createdAt
                                  ? new Date(c.createdAt).toLocaleDateString()
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </dd>
              </div>
            </AdminOrderListCard>
          </>
        }
        sidebar={
          <>
            <ProductFormOrderCard
              icon={<LinkIcon className="h-4 w-4" />}
              title="Your referral link"
              subtitle="Share this link to track clicks, signups, and commissions"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Referral code</dt>
                <dd>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {dash.referralCode}
                  </p>
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Share link</dt>
                <dd className="space-y-3">
                  <div className="break-all rounded-xl border border-border/60 bg-sunken/50 px-3 py-2 font-mono text-sm text-foreground">
                    {dash.referralLink}
                  </div>
                  <button
                    type="button"
                    onClick={onCopy}
                    className="dashboard-pro-btn text-xs"
                  >
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                </dd>
              </div>
            </ProductFormOrderCard>

            <ProductFormOrderCard
              icon={<ChartIcon className="h-4 w-4" />}
              title="Affiliate guide"
              subtitle="How sharing, commissions, and payouts work"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Share your link</dt>
                <dd className="text-sm text-foreground-muted">
                  Send your personal referral link. Clicks and signups are tracked
                  automatically when friends register through it.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Earn commission</dt>
                <dd className="text-sm text-foreground-muted">
                  You earn {ratePct}% on qualifying referred orders. Pending
                  commissions appear here until approved.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Payouts</dt>
                <dd className="text-sm text-foreground-muted">
                  Approved commissions are credited to your{" "}
                  <Link href="/wallet" className="text-accent hover:underline">
                    wallet
                  </Link>
                  . Withdraw from there when funds are available.
                </dd>
              </div>
            </ProductFormOrderCard>

            <ProductFormOrderCard
              icon={<WalletIcon className="h-4 w-4" />}
              title="Need help?"
              subtitle="Affiliate and payout support"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Support</dt>
                <dd className="space-y-3 text-sm text-foreground-muted">
                  <p>
                    Questions about commission tracking, approval, or wallet
                    payouts? Our team can help.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/chat" className="dashboard-pro-btn text-xs">
                      Live chat
                    </Link>
                    <Link
                      href="/support"
                      className="dashboard-pro-btn-ghost text-xs"
                    >
                      Support center
                    </Link>
                  </div>
                </dd>
              </div>
            </ProductFormOrderCard>
          </>
        }
      />
    </>
  );
}
