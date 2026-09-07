"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { DownloadsView } from "@/components/customer/DownloadsView";
import { getDownloads, type DownloadItem } from "@/lib/api";

export default function DownloadsPage() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDownloads()
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const headerAction = useMemo(() => {
    const totalCodes = items.reduce((sum, item) => sum + item.codes.length, 0);
    const orderCount = new Set(items.map((item) => item.orderId)).size;

    return (
      <div className="flex flex-wrap justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--brand">
          {items.length} {items.length === 1 ? "product" : "products"}
        </span>
        <span className="dashboard-pro-status dashboard-pro-status--green">
          {totalCodes} {totalCodes === 1 ? "code" : "codes"}
        </span>
        {orderCount > 0 ? (
          <span className="dashboard-pro-status">
            {orderCount} {orderCount === 1 ? "order" : "orders"}
          </span>
        ) : null}
      </div>
    );
  }, [items]);

  return (
    <CustomerPageLayout
      section="Account"
      title="Downloads"
      description="All delivered digital goods from your completed orders."
      iconKey="downloads"
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading}
      loadingText="Loading downloads…"
      action={loading ? null : headerAction}
    >
      <DownloadsView items={items} />
    </CustomerPageLayout>
  );
}
