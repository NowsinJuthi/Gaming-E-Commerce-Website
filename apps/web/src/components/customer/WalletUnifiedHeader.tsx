"use client";

import Link from "next/link";
import { PriceText } from "@/components/ui/PriceText";
import { WalletIcon } from "@/components/admin/icons";
import type { Wallet } from "@/lib/api";

type Props = {
  wallet: Wallet;
  txnCount: number;
};

export function WalletUnifiedHeader({ wallet, txnCount }: Props) {
  const currency = wallet.currency ?? "BDT";

  return (
    <article className="customer-wallet-unified-header-card customer-dashboard-mobile-header-card">
      <div className="customer-dashboard-mobile-header-glow" aria-hidden />

      <section className="customer-dashboard-mobile-header-main">
        <div className="customer-dashboard-mobile-header-welcome-row">
          <span className="customer-dashboard-mobile-header-avatar" aria-hidden>
            <WalletIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h1
              id="customer-wallet-page-title"
              className="customer-dashboard-unified-header-title"
            >
              Wallet
            </h1>
            <p className="customer-dashboard-mobile-welcome-sub">
              Manage your balance, request withdrawals, and review transaction
              history.
            </p>
            <p className="customer-wallet-unified-balance">
              <PriceText amount={wallet.balance} currency={currency} />
              <span className="customer-wallet-unified-balance-meta">
                available balance
                {txnCount > 0
                  ? ` · ${txnCount} recent transaction${txnCount === 1 ? "" : "s"}`
                  : ""}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section
        className="customer-dashboard-mobile-header-actions"
        aria-label="Wallet status and navigation"
      >
        <Link
          href="/dashboard"
          className="customer-dashboard-mobile-chip customer-dashboard-mobile-chip--store"
        >
          ← Dashboard
        </Link>
        {wallet.pendingBalance > 0 ? (
          <span className="customer-dashboard-mobile-chip customer-dashboard-mobile-chip--amber">
            Pending{" "}
            <PriceText amount={wallet.pendingBalance} currency={currency} />
          </span>
        ) : null}
      </section>
    </article>
  );
}
