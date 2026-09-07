"use client";

import Link from "next/link";
import { PriceText } from "@/components/ui/PriceText";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import {
  DollarIcon,
  GridIcon,
  WalletIcon,
} from "@/components/admin/icons";
import { CustomerOrdersOverviewCard } from "@/components/customer/CustomerOrdersOverviewCard";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  type CustomerOrderStats,
  type OrderDetail,
  type UserProfile,
  type Wallet,
} from "@/lib/api";

type WalletTxn = {
  _id: string;
  type: string;
  amount: number;
  currency: string;
  description?: string;
  createdAt?: string;
};

const TOPUP_PRESETS = [100, 250, 500, 1000];

type Props = {
  profile: UserProfile | null;
  wallet: Wallet | null;
  orders: OrderDetail[];
  orderStats: CustomerOrderStats | null;
  txns: WalletTxn[];
  txnPage: number;
  txnTotal: number;
  txnPageSize: number;
  txnsLoading: boolean;
  onTxnPageChange: (page: number) => void;
  gatewayEnabled: boolean;
  topupAmount: string;
  topupBusy: boolean;
  topupMsg: { text: string; ok: boolean } | null;
  amount: string;
  method: string;
  account: string;
  msg: { text: string; ok: boolean } | null;
  busy: boolean;
  onTopupAmountChange: (value: string) => void;
  onTopUp: (e: React.FormEvent) => void;
  onAmountChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onWithdraw: (e: React.FormEvent) => void;
};

function formatTxnType(type: string) {
  return type.replace(/_/g, " ");
}

function FeedbackBanner({ msg }: { msg: { text: string; ok: boolean } }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        msg.ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
      }`}
    >
      {msg.text}
    </div>
  );
}

export function WalletView({
  profile,
  wallet,
  orders,
  orderStats,
  txns,
  txnPage,
  txnTotal,
  txnPageSize,
  txnsLoading,
  onTxnPageChange,
  gatewayEnabled,
  topupAmount,
  topupBusy,
  topupMsg,
  amount,
  method,
  account,
  msg,
  busy,
  onTopupAmountChange,
  onTopUp,
  onAmountChange,
  onMethodChange,
  onAccountChange,
  onWithdraw,
}: Props) {
  const currency = wallet?.currency ?? orderStats?.currency ?? "BDT";
  const totalOrders = orderStats?.totalOrders ?? orders.length;
  const totalSpent = orderStats?.totalSpent ?? 0;
  const totalPages = Math.max(1, Math.ceil(txnTotal / txnPageSize));
  const pageStart = txnTotal === 0 ? 0 : (txnPage - 1) * txnPageSize + 1;
  const pageEnd = Math.min(txnPage * txnPageSize, txnTotal);

  return (
    <>
      <div className="admin-wallet-layout customer-wallet-page">
        <AdminOrderTwoColumnLayout
        main={
          <AdminOrderListCard
            icon={<WalletIcon className="h-4 w-4" />}
            title="Wallet overview"
            subtitle="Balance, orders, and account summary"
            className="admin-wallet-catalog"
          >
            {profile && wallet ? (
              <>
                <CustomerOrdersOverviewCard
                  profile={profile}
                  wallet={wallet}
                  orders={orders}
                  totalOrders={totalOrders}
                  totalSpent={totalSpent}
                  currency={currency}
                />

                <div className="flex flex-wrap justify-end gap-2.5">
                  <Link href="/orders" className="dashboard-pro-btn-ghost text-xs">
                    Order history
                  </Link>
                  <Link href="/products" className="dashboard-pro-btn-ghost text-xs">
                    Browse store
                  </Link>
                </div>
              </>
            ) : null}

            <div className="admin-products-filters-list">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-strong/40 pb-4">
                <p className="text-sm font-semibold text-foreground">
                  Transaction history
                </p>
                <span className="text-xs text-foreground-muted">
                  {txnTotal > 0
                    ? `Showing ${pageStart}–${pageEnd} of ${txnTotal.toLocaleString()}`
                    : "Credits, debits, and withdrawals"}
                </span>
              </div>
            </div>

            {txnsLoading ? (
              <div className="admin-products-table-empty">Loading transactions…</div>
            ) : txns.length === 0 ? (
              <div className="dashboard-pro-empty px-4 py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <GridIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  No transactions yet
                </p>
                <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                  Top-ups, purchases, and withdrawals will appear here.
                </p>
              </div>
            ) : (
              <div className="admin-products-table-wrap admin-wallet-table-wrap overflow-x-auto">
                <table className="admin-wallet-table w-full">
                  <thead className="admin-wallet-table-head">
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Note</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t._id}>
                        <td className="capitalize font-medium text-foreground">
                          {formatTxnType(t.type)}
                        </td>
                        <td>
                          <PriceText amount={t.amount} currency={t.currency} />
                        </td>
                        <td className="max-w-[220px] truncate text-subtle">
                          {t.description ?? "—"}
                        </td>
                        <td className="whitespace-nowrap text-foreground-muted">
                          {t.createdAt
                            ? new Date(t.createdAt).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 ? (
              <nav
                className="mt-4 flex flex-wrap items-center justify-between gap-3"
                aria-label="Transaction history pagination"
              >
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm"
                  disabled={txnPage <= 1 || txnsLoading}
                  onClick={() => onTxnPageChange(Math.max(1, txnPage - 1))}
                >
                  Previous
                </button>
                <span className="text-sm text-subtle">
                  Page {txnPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm"
                  disabled={txnPage >= totalPages || txnsLoading}
                  onClick={() =>
                    onTxnPageChange(Math.min(totalPages, txnPage + 1))
                  }
                >
                  Next
                </button>
              </nav>
            ) : null}
          </AdminOrderListCard>
        }
        sidebar={
          <>
            {gatewayEnabled ? (
              <ProductFormOrderCard
                icon={<WalletIcon className="h-4 w-4" />}
                title="Add funds"
                subtitle="Top up via bKash, Nagad, Rocket, or Upay"
                className="admin-product-form-section admin-wallet-sidebar-card"
              >
                <form onSubmit={onTopUp} className="space-y-4">
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Amount (BDT)</dt>
                    <dd className="space-y-3">
                      <input
                        type="number"
                        min={1}
                        step="1"
                        required
                        value={topupAmount}
                        onChange={(e) => onTopupAmountChange(e.target.value)}
                        placeholder="Enter amount to add"
                        className="admin-input w-full"
                      />
                      <div className="flex flex-wrap gap-2">
                        {TOPUP_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => onTopupAmountChange(String(preset))}
                            className={`dashboard-pro-btn-ghost text-xs ${
                              topupAmount === String(preset)
                                ? "ring-1 ring-brand/40 bg-brand/10"
                                : ""
                            }`}
                          >
                            ৳{preset.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </dd>
                  </div>
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Payment</dt>
                    <dd className="space-y-3">
                      <p className="text-sm text-foreground-muted">
                        Pay with MFS and verify using your TrxID on the secure
                        checkout page.
                      </p>
                      <button
                        type="submit"
                        disabled={topupBusy}
                        className="btn-primary w-full disabled:opacity-50"
                      >
                        {topupBusy ? "Starting payment…" : "Pay & Add Balance"}
                      </button>
                    </dd>
                  </div>
                  {topupMsg ? <FeedbackBanner msg={topupMsg} /> : null}
                </form>
              </ProductFormOrderCard>
            ) : null}

            <ProductFormOrderCard
              icon={<DollarIcon className="h-4 w-4" />}
              title="Request withdrawal"
              subtitle="Transfer balance to bKash, Nagad, Rocket, or bank"
              className="admin-product-form-section admin-wallet-sidebar-card"
            >
              <form onSubmit={onWithdraw} className="space-y-4">
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Amount</dt>
                  <dd>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => onAmountChange(e.target.value)}
                      placeholder="Enter amount"
                      className="admin-input w-full"
                    />
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Payout method</dt>
                  <dd>
                    <select
                      value={method}
                      onChange={(e) => onMethodChange(e.target.value)}
                      className="admin-select w-full"
                    >
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                      <option value="bank">Bank</option>
                    </select>
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Account</dt>
                  <dd>
                    <input
                      value={account}
                      onChange={(e) => onAccountChange(e.target.value)}
                      placeholder="Account or mobile number"
                      className="admin-input w-full"
                    />
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Submit</dt>
                  <dd>
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {busy ? "Submitting…" : "Submit request"}
                    </button>
                  </dd>
                </div>
                {msg ? <FeedbackBanner msg={msg} /> : null}
              </form>
            </ProductFormOrderCard>
          </>
        }
        />
      </div>
    </>
  );
}
