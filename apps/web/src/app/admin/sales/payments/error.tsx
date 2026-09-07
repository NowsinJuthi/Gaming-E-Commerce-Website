"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminPaymentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/sales/payments]", error);
  }, [error]);

  return (
    <div className="shell-panel mx-auto max-w-lg p-8 text-center">
      <h1 className="text-lg font-bold text-foreground">Payments page error</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        This page failed to load. Try again, or open Orders and return here.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary btn-primary-sm">
          Try again
        </button>
        <Link href="/admin/sales/orders" className="dashboard-pro-btn-ghost">
          Open orders
        </Link>
      </div>
    </div>
  );
}
