"use client";

import Link from "next/link";
import { GridIcon, ReceiptIcon } from "@/components/admin/icons";
import { CustomerOrderCard } from "@/components/customer/CustomerOrderCard";
import { CustomerOrdersOverviewCard } from "@/components/customer/CustomerOrdersOverviewCard";
import {
  type CustomerOrderStats,
  type OrderDetail,
  type UserProfile,
  type Wallet,
} from "@/lib/api";

type Props = {
  profile: UserProfile;
  wallet: Wallet | null;
  orders: OrderDetail[];
  orderStats: CustomerOrderStats | null;
};

export function DashboardView({ profile, wallet, orders, orderStats }: Props) {
  const recentOrders = orders.slice(0, 5);
  const totalOrders = orderStats?.totalOrders ?? orders.length;
  const totalSpent = orderStats?.totalSpent ?? 0;
  const orderCurrency =
    orderStats?.currency ?? orders[0]?.pricing?.currency ?? "BDT";

  return (
    <div className="customer-dashboard-page min-w-0">
      {!profile.emailVerified ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 sm:flex-row sm:items-center sm:justify-between">
          <p>Your email is not verified yet. Verify to secure your account.</p>
          <Link
            href="/verify-email"
            className="dashboard-pro-btn shrink-0 self-start sm:self-auto"
          >
            Verify now
          </Link>
        </div>
      ) : null}

      <div className="customer-dashboard-stack">
        <CustomerOrdersOverviewCard
          profile={profile}
          wallet={wallet}
          orders={orders}
          totalOrders={totalOrders}
          totalSpent={totalSpent}
          currency={orderCurrency}
        />

        <section
          className="customer-dashboard-recent-orders-section"
          aria-labelledby="customer-dashboard-recent-orders-title"
        >
          <header
            className="customer-dashboard-recent-orders-head-card customer-dashboard-mobile-header-card mb-2 max-lg:mb-1.5"
          >
            <div
              className="customer-dashboard-mobile-header-glow"
              aria-hidden
            />
            <div className="customer-dashboard-mobile-header-main">
              <div className="customer-dashboard-mobile-header-welcome-row">
                <span
                  className="customer-dashboard-mobile-header-avatar"
                  aria-hidden
                >
                  <ReceiptIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2
                    id="customer-dashboard-recent-orders-title"
                    className="customer-dashboard-mobile-page-title"
                  >
                    Recent orders
                  </h2>
                  <p className="customer-dashboard-mobile-welcome-sub">
                    Your latest purchases and delivery status
                  </p>
                </div>
              </div>
            </div>
          </header>

          {recentOrders.length === 0 ? (
            <div className="dashboard-pro-empty py-8">
              <span className="dashboard-pro-empty-icon" aria-hidden>
                <GridIcon className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-foreground">
                No orders yet
              </p>
              <p className="mt-1 text-xs text-subtle">
                Start shopping to see your purchases here.
              </p>
              <Link href="/products" className="dashboard-pro-btn mt-4">
                Browse products
              </Link>
            </div>
          ) : (
            <div className="customer-orders-list">
              {recentOrders.map((order) => (
                <CustomerOrderCard
                  key={order._id}
                  order={order}
                  flatExpandedItems
                />
              ))}
              <div className="flex justify-end pt-1">
                <Link
                  href="/orders"
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  View all orders
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
