"use client";

import Link from "next/link";
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
  GridIcon,
  LinkIcon,
  PulseIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { formatPrice, type AffiliateDashboard } from "@/lib/api";
import { REFERRAL_QUICK_LINKS } from "@/lib/customer-quick-links";

type Props = {
  dash: AffiliateDashboard | null;
  copied: boolean;
  onCopy: () => void;
};

export function ReferralView({ dash, copied, onCopy }: Props) {
  const affiliate = dash?.affiliate ?? null;
  const ratePct = affiliate ? Math.round(affiliate.commissionRate * 100) : 0;

  const introSubtitle = dash
    ? `Code ${dash.referralCode} · ${ratePct}% commission · Share your link to earn`
    : "Invite friends and earn when they shop";

  if (!dash) {
    return (
      <>
        <AdminOrderPageIntro
          icon={<LinkIcon className="h-4 w-4" />}
          title="Account referral"
          subtitle="Referral program is not available yet"
          quickLinks={REFERRAL_QUICK_LINKS}
          quickNavLabel="Account shortcuts"
        />

        <AdminOrderTwoColumnLayout
          main={
            <AdminOrderListCard
              icon={<LinkIcon className="h-4 w-4" />}
              title="Referral program"
              subtitle="Invite friends and earn commission on their orders"
            >
              <div className="dashboard-pro-empty py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <GridIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Referral program unavailable
                </p>
                <p className="mt-1 text-xs text-subtle">
                  The referral program may not be enabled for your account yet.
                  Check the affiliate dashboard for more options.
                </p>
                <Link href="/affiliate" className="dashboard-pro-btn mt-4">
                  Open affiliate program
                </Link>
              </div>
            </AdminOrderListCard>
          }
          sidebar={
            <ProductFormOrderCard
              icon={<SettingsIcon className="h-4 w-4" />}
              title="Need help?"
              subtitle="Referral and affiliate support"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Support</dt>
                <dd className="space-y-3 text-sm text-foreground-muted">
                  <p>
                    Questions about referrals or affiliate earnings? Contact
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
        icon={<LinkIcon className="h-4 w-4" />}
        title="Account referral"
        subtitle={introSubtitle}
        quickLinks={REFERRAL_QUICK_LINKS}
        quickNavLabel="Account shortcuts"
      />

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<LinkIcon className="h-4 w-4" />}
              title="Referral overview"
              subtitle={`${affiliate?.clicks ?? 0} clicks · ${affiliate?.signups ?? 0} signups · ${affiliate?.conversions ?? 0} conversions`}
            >
              <AdminOrderStatsGrid>
                <AdminOrderStatField
                  icon={<PulseIcon className="h-4 w-4" />}
                  label="Link clicks"
                  value={(affiliate?.clicks ?? 0).toLocaleString()}
                  meta="Referral link visits"
                />
                <AdminOrderStatField
                  icon={<UsersIcon className="h-4 w-4" />}
                  label="Signups"
                  value={(affiliate?.signups ?? 0).toLocaleString()}
                  meta="Friends who registered"
                />
                <AdminOrderStatField
                  icon={<CheckIcon className="h-4 w-4" />}
                  label="Conversions"
                  value={(affiliate?.conversions ?? 0).toLocaleString()}
                  meta="Completed referred orders"
                />
                <AdminOrderStatField
                  icon={<ChartIcon className="h-4 w-4" />}
                  label="Commission"
                  value={`${ratePct}%`}
                  meta="Your referral rate"
                />
              </AdminOrderStatsGrid>

              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-4 text-xs text-foreground-muted">
                <span>
                  <span className="font-semibold text-foreground">Earned</span>{" "}
                  {formatPrice(affiliate?.totalEarned ?? 0, "BDT")}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Pending</span>{" "}
                  <PriceText
                    amount={affiliate?.totalPending ?? 0}
                    currency="BDT"
                  />
                </span>
                <span>
                  <span className="font-semibold text-foreground">Status</span>{" "}
                  <span className="capitalize">{affiliate?.status ?? "—"}</span>
                </span>
              </div>

              <div className="flex flex-wrap justify-end gap-2.5">
                <Link href="/affiliate" className="dashboard-pro-btn-ghost text-xs">
                  Affiliate dashboard
                </Link>
                <Link href="/rewards" className="dashboard-pro-btn-ghost text-xs">
                  Rewards
                </Link>
              </div>
            </AdminOrderListCard>

            <ProductFormOrderCard
              icon={<LinkIcon className="h-4 w-4" />}
              title="Your referral link"
              subtitle="Share this link — friends who register and order earn you commission"
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
          </>
        }
        sidebar={
          <>
            <ProductFormOrderCard
              icon={<LinkIcon className="h-4 w-4" />}
              title="Referral guide"
              subtitle="How sharing and earnings work"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Share your link</dt>
                <dd className="text-sm text-foreground-muted">
                  Send your personal referral link to friends. When they register
                  through it, they are linked to your account.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Earn commission</dt>
                <dd className="text-sm text-foreground-muted">
                  You earn {ratePct}% commission when referred friends complete
                  qualifying orders. Pending earnings are reviewed before payout.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Affiliate dashboard</dt>
                <dd className="text-sm text-foreground-muted">
                  View detailed clicks, commissions, and payout history on the{" "}
                  <Link href="/affiliate" className="text-accent hover:underline">
                    affiliate dashboard
                  </Link>
                  .
                </dd>
              </div>
            </ProductFormOrderCard>

            <ProductFormOrderCard
              icon={<SettingsIcon className="h-4 w-4" />}
              title="Need help?"
              subtitle="Referral program support"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Support</dt>
                <dd className="space-y-3 text-sm text-foreground-muted">
                  <p>
                    Questions about referral tracking, commissions, or payouts?
                    Our team can help.
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
