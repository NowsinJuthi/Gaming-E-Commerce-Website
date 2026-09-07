"use client";

import Link from "next/link";
import { GridIcon } from "@/components/admin/icons";
import { CustomerOrderCard } from "@/components/customer/CustomerOrderCard";
import { type OrderDetail } from "@/lib/api";

type Props = {
  orders: OrderDetail[];
};

export function CustomerOrdersView({ orders }: Props) {
  return (
    <div className="customer-orders-page min-w-0">
      {orders.length === 0 ? (
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
          {orders.map((order) => (
            <CustomerOrderCard
              key={order._id}
              order={order}
              flatExpandedItems
            />
          ))}
        </div>
      )}
    </div>
  );
}
