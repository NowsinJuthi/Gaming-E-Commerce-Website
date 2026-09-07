"use client";

import type { ReactNode } from "react";
import { PriceText } from "@/components/ui/PriceText";
import {
  BoxIcon,
  CheckIcon,
  PulseIcon,
  ReceiptIcon,
  ShieldIcon,
  WalletIcon,
} from "@/components/admin/icons";
import {
  formatPrice,
  type OrderDetail,
  type UserProfile,
  type Wallet,
} from "@/lib/api";

type Props = {
  profile: UserProfile;
  wallet: Wallet | null;
  orders: OrderDetail[];
  totalOrders?: number;
  totalSpent?: number;
  currency?: string;
};

type StatTone = "brand" | "success" | "amber" | "muted";

type OverviewStat = {
  key: string;
  tone: StatTone;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta: string;
};

function isInProgress(status: OrderDetail["status"]) {
  return status === "pending" || status === "processing" || status === "paid";
}

export function CustomerOrdersOverviewCard({
  profile,
  wallet,
  orders,
  totalOrders,
  totalSpent,
  currency,
}: Props) {
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const pendingCount = orders.filter((o) => isInProgress(o.status)).length;

  const orderCount = totalOrders ?? orders.length;
  const orderCurrency = currency ?? orders[0]?.pricing?.currency ?? "BDT";
  const spent =
    totalSpent ??
    orders.reduce((sum, order) => sum + (order.pricing?.total ?? 0), 0);

  const stats: OverviewStat[] = [
    {
      key: "wallet",
      tone: "amber",
      icon: <WalletIcon className="h-4 w-4" aria-hidden />,
      label: "Wallet balance",
      value: wallet ? (
        <PriceText amount={wallet.balance} currency={wallet.currency} />
      ) : (
        "—"
      ),
      meta:
        wallet && wallet.pendingBalance > 0
          ? `Pending: ${formatPrice(wallet.pendingBalance, wallet.currency)}`
          : "Top up or withdraw",
    },
    {
      key: "orders",
      tone: "brand",
      icon: <BoxIcon className="h-4 w-4" aria-hidden />,
      label: "Total orders",
      value: orderCount.toLocaleString(),
      meta: "All-time purchases",
    },
    {
      key: "spent",
      tone: "amber",
      icon: <ReceiptIcon className="h-4 w-4" aria-hidden />,
      label: "Total spent",
      value: <PriceText amount={spent} currency={orderCurrency} />,
      meta:
        orderCount > 0
          ? `Across ${orderCount} ${orderCount === 1 ? "order" : "orders"}`
          : "No purchases yet",
    },
    {
      key: "delivered",
      tone: "success",
      icon: <CheckIcon className="h-4 w-4" aria-hidden />,
      label: "Delivered",
      value: deliveredCount.toLocaleString(),
      meta: "Completed deliveries",
    },
    {
      key: "progress",
      tone: "success",
      icon: <PulseIcon className="h-4 w-4" aria-hidden />,
      label: "In progress",
      value: pendingCount.toLocaleString(),
      meta: "Pending or processing",
    },
    {
      key: "account",
      tone: profile.emailVerified ? "success" : "amber",
      icon: <ShieldIcon className="h-4 w-4" aria-hidden />,
      label: "Account status",
      value: <span className="capitalize">{profile.status ?? "active"}</span>,
      meta: profile.emailVerified ? "Email verified" : "Email not verified",
    },
  ];

  return (
    <section
      className="customer-dashboard-overview-section"
      aria-labelledby="customer-dashboard-overview-title"
    >
      <dl className="customer-dashboard-overview-stats">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${stat.tone}`}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              {stat.icon}
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                {stat.label}
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {stat.value}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                {stat.meta}
              </p>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
