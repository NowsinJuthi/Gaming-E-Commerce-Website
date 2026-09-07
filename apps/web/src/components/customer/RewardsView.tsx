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
  ReceiptIcon,
  SettingsIcon,
  StarIcon,
  TagIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { formatPrice, type RewardsSummary } from "@/lib/api";
import { REWARDS_QUICK_LINKS } from "@/lib/customer-quick-links";

type Props = {
  data: RewardsSummary | null;
  loadError: string | null;
};

export function RewardsView({ data, loadError }: Props) {
  if (loadError) {
    return (
      <>
        <AdminOrderPageIntro
          icon={<TagIcon className="h-4 w-4" />}
          title="Rewards program"
          subtitle="Could not load rewards"
          quickLinks={REWARDS_QUICK_LINKS}
          quickNavLabel="Account shortcuts"
        />

        <AdminOrderTwoColumnLayout
          main={
            <AdminOrderListCard
              icon={<TagIcon className="h-4 w-4" />}
              title="Rewards program"
              subtitle="Loyalty points from your purchases"
            >
              <div className="dashboard-pro-empty py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <GridIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  {loadError}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  Try refreshing the page or contact support if the problem
                  continues.
                </p>
                <Link href="/chat" className="dashboard-pro-btn mt-4">
                  Contact support
                </Link>
              </div>
            </AdminOrderListCard>
          }
          sidebar={
            <ProductFormOrderCard
              icon={<SettingsIcon className="h-4 w-4" />}
              title="Need help?"
              subtitle="Rewards program support"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Support</dt>
                <dd className="space-y-3 text-sm text-foreground-muted">
                  <p>
                    Having trouble loading your rewards? Our team can help.
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

  if (!data) return null;

  if (!data.enabled) {
    return (
      <>
        <AdminOrderPageIntro
          icon={<TagIcon className="h-4 w-4" />}
          title="Rewards program"
          subtitle="Loyalty points program is currently disabled"
          quickLinks={REWARDS_QUICK_LINKS}
          quickNavLabel="Account shortcuts"
        />

        <AdminOrderTwoColumnLayout
          main={
            <AdminOrderListCard
              icon={<TagIcon className="h-4 w-4" />}
              title="Rewards program"
              subtitle="Earn points on delivered orders"
            >
              <div className="dashboard-pro-empty py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <GridIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Rewards program disabled
                </p>
                <p className="mt-1 text-xs text-subtle">
                  The loyalty points program is not active right now. Check back
                  later or browse the store.
                </p>
                <Link href="/products" className="dashboard-pro-btn mt-4">
                  Browse store
                </Link>
              </div>
            </AdminOrderListCard>
          }
          sidebar={
            <ProductFormOrderCard
              icon={<SettingsIcon className="h-4 w-4" />}
              title="Need help?"
              subtitle="Rewards program support"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Support</dt>
                <dd className="space-y-3 text-sm text-foreground-muted">
                  <p>
                    Questions about the rewards program? Contact support for
                    assistance.
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

  const ptsToRedeem = Math.max(0, data.redeemThreshold - data.points);
  const earnRateLabel = `${data.pointsPerCurrency} pt${data.pointsPerCurrency === 1 ? "" : "s"} per ${formatPrice(1, "BDT")}`;

  const introSubtitle = `${data.points.toLocaleString()} points · ${earnRateLabel} · Redeem at ${data.redeemThreshold} pts`;

  return (
    <>
      <AdminOrderPageIntro
        icon={<TagIcon className="h-4 w-4" />}
        title="Rewards program"
        subtitle={introSubtitle}
        quickLinks={REWARDS_QUICK_LINKS}
        quickNavLabel="Account shortcuts"
      />

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<TagIcon className="h-4 w-4" />}
              title="Rewards overview"
              subtitle={
                data.canRedeem
                  ? "You have enough points to redeem"
                  : `${ptsToRedeem} points until redeem threshold`
              }
            >
              <AdminOrderStatsGrid>
                <AdminOrderStatField
                  icon={<StarIcon className="h-4 w-4" />}
                  label="Your points"
                  value={data.points.toLocaleString()}
                  meta={`Redeem at ${data.redeemThreshold} pts`}
                />
                <AdminOrderStatField
                  icon={<ChartIcon className="h-4 w-4" />}
                  label="Lifetime earned"
                  value={data.lifetimePoints.toLocaleString()}
                  meta="All-time points from orders"
                />
                <AdminOrderStatField
                  icon={<CheckIcon className="h-4 w-4" />}
                  label="Redeem threshold"
                  value={data.redeemThreshold.toLocaleString()}
                  meta="Points needed to redeem"
                />
                <AdminOrderStatField
                  icon={<TagIcon className="h-4 w-4" />}
                  label="Earn rate"
                  value={earnRateLabel}
                  meta="On delivered orders"
                />
              </AdminOrderStatsGrid>

              <div className="space-y-2 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between text-xs text-foreground-muted">
                  <span>Progress to redeem</span>
                  <span className="font-semibold text-foreground">
                    {Math.round(data.redeemProgress)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${data.redeemProgress}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                <span>
                  <span className="font-semibold text-foreground">Balance</span>{" "}
                  {data.points} pts
                </span>
                <span>
                  <span className="font-semibold text-foreground">Lifetime</span>{" "}
                  {data.lifetimePoints} pts
                </span>
                <span>
                  <span className="font-semibold text-foreground">Orders</span>{" "}
                  {data.history.length}
                </span>
              </div>

              {data.canRedeem ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  You can redeem rewards — contact support to claim your points.
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Link href="/orders" className="dashboard-pro-btn-ghost text-xs">
                  My orders
                </Link>
                <Link href="/wallet" className="dashboard-pro-btn-ghost text-xs">
                  Wallet
                </Link>
                <Link href="/products" className="dashboard-pro-btn-ghost text-xs">
                  Browse store
                </Link>
              </div>
            </AdminOrderListCard>

            <AdminOrderListCard
              icon={<ReceiptIcon className="h-4 w-4" />}
              title="Points history"
              subtitle={
                data.history.length > 0
                  ? `${data.history.length} orders earned points`
                  : "Points from delivered orders"
              }
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>History</dt>
                <dd>
                  {data.history.length === 0 ? (
                    <div className="dashboard-pro-empty py-8">
                      <span className="dashboard-pro-empty-icon" aria-hidden>
                        <GridIcon className="h-6 w-6" />
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        No points yet
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        Points accrue on delivered orders. Start shopping to
                        earn rewards.
                      </p>
                      <Link href="/products" className="dashboard-pro-btn mt-4">
                        Browse products
                      </Link>
                    </div>
                  ) : (
                    <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                      <table className="panel-3d-table w-full text-sm">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Spent</th>
                            <th>Points</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.history.map((h) => (
                            <tr key={h.orderId} className="text-foreground-muted">
                              <td className="font-medium text-foreground">
                                {h.orderNumber ?? `…${h.orderId.slice(-8)}`}
                              </td>
                              <td>
                                <PriceText amount={h.total} currency="BDT" />
                              </td>
                              <td className="font-semibold text-brand">
                                +{h.points}
                              </td>
                              <td className="whitespace-nowrap">
                                {h.createdAt
                                  ? new Date(h.createdAt).toLocaleDateString()
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
              icon={<TagIcon className="h-4 w-4" />}
              title="Rewards guide"
              subtitle="How points are earned and redeemed"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Earn points</dt>
                <dd className="text-sm text-foreground-muted">
                  You earn {earnRateLabel} on delivered orders. Points are added
                  after your order is fulfilled.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Redeem rewards</dt>
                <dd className="text-sm text-foreground-muted">
                  {data.canRedeem
                    ? "You have reached the redeem threshold. Contact support to redeem your points."
                    : `${ptsToRedeem} more points needed to reach the ${data.redeemThreshold} point redeem threshold.`}
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Order history</dt>
                <dd className="text-sm text-foreground-muted">
                  View delivered purchases under{" "}
                  <Link href="/orders" className="text-accent hover:underline">
                    My orders
                  </Link>
                  .
                </dd>
              </div>
            </ProductFormOrderCard>

            <ProductFormOrderCard
              icon={<SettingsIcon className="h-4 w-4" />}
              title="Need help?"
              subtitle="Rewards and redemption support"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Support</dt>
                <dd className="space-y-3 text-sm text-foreground-muted">
                  <p>
                    Questions about points balance, earning, or redemption?
                    Contact support to redeem or get help.
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
