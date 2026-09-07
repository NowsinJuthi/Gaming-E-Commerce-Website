"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PriceText } from "@/components/ui/PriceText";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { WalletView } from "@/components/customer/WalletView";
import {
  createPayment,
  getCustomerPanelConfig,
  getMe,
  getOrderStats,
  getWallet,
  getWalletTransactions,
  listOrders,
  requestWalletWithdraw,
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

const TXN_PAGE_SIZE = 10;

export default function WalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [orderStats, setOrderStats] = useState<CustomerOrderStats | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotal, setTxnTotal] = useState(0);
  const [amount, setAmount] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [account, setAccount] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [topupMsg, setTopupMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [topupBusy, setTopupBusy] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [txnsLoading, setTxnsLoading] = useState(true);

  const loadTxns = useCallback(async (page: number) => {
    setTxnsLoading(true);
    try {
      const r = await getWalletTransactions(page, TXN_PAGE_SIZE);
      setTxns(r.items);
      setTxnTotal(r.total);
      setTxnPage(r.page);
    } catch {
      setTxns([]);
      setTxnTotal(0);
    } finally {
      setTxnsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getWallet(),
      getCustomerPanelConfig(),
      getMe(),
      listOrders(1, 50)
        .then((r) => r.items)
        .catch(() => []),
      getOrderStats().catch(() => null),
    ])
      .then(([w, config, me, o, stats]) => {
        if (cancelled) return;
        setWallet(w);
        setGatewayEnabled(config.checkout.gatewayEnabled !== false);
        setProfile(me);
        setOrders(o);
        setOrderStats(stats);
      })
      .catch(() => {
        if (!cancelled) {
          setWallet(null);
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadTxns(txnPage);
  }, [txnPage, loadTxns]);

  async function onTopUp(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(topupAmount);
    if (!numAmount || numAmount < 1) {
      setTopupMsg({ text: "Please enter a valid amount (min ৳1).", ok: false });
      return;
    }
    if (!gatewayEnabled) {
      setTopupMsg({
        text: "Online top-up is currently unavailable. Contact support.",
        ok: false,
      });
      return;
    }

    setTopupBusy(true);
    setTopupMsg(null);
    try {
      const payment = await createPayment({
        gateway: "mfs",
        purpose: "wallet_topup",
        amount: numAmount,
        idempotencyKey: `wallet-topup-${Date.now()}`,
      });
      if (payment.checkoutUrl && /^https?:\/\//i.test(payment.checkoutUrl)) {
        window.location.href = payment.checkoutUrl;
        return;
      }
      router.push(`/checkout/pay/${payment.intentId}`);
    } catch (err) {
      setTopupMsg({
        text: err instanceof Error ? err.message : "Could not start payment",
        ok: false,
      });
    } finally {
      setTopupBusy(false);
    }
  }

  async function onWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setMsg({ text: "Please enter a valid amount.", ok: false });
      return;
    }
    if (wallet && numAmount > wallet.balance) {
      setMsg({ text: "Amount exceeds available balance.", ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await requestWalletWithdraw({
        amount: numAmount,
        method,
        accountNumber: account,
      });
      setMsg({ text: "Withdrawal requested.", ok: true });
      setAmount("");
      const w = await getWallet();
      setWallet(w);
      if (txnPage === 1) {
        await loadTxns(1);
      } else {
        setTxnPage(1);
      }
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Withdrawal failed",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  }

  const headerAction = useMemo(() => {
    if (!wallet) return null;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--green">
          <PriceText amount={wallet.balance} currency={wallet.currency} /> available
        </span>
        {wallet.pendingBalance > 0 ? (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            Pending{" "}
            <PriceText
              amount={wallet.pendingBalance}
              currency={wallet.currency}
            />
          </span>
        ) : null}
      </div>
    );
  }, [wallet]);

  return (
    <CustomerPageLayout
      section="Account"
      title="Wallet"
      description="Add funds, request withdrawals, and review transaction history."
      iconKey="wallet"
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading}
      loadingText="Loading wallet…"
      action={loading ? null : headerAction}
    >
      <WalletView
        profile={profile}
        wallet={wallet}
        orders={orders}
        orderStats={orderStats}
        txns={txns}
        txnPage={txnPage}
        txnTotal={txnTotal}
        txnPageSize={TXN_PAGE_SIZE}
        txnsLoading={txnsLoading}
        onTxnPageChange={setTxnPage}
        gatewayEnabled={gatewayEnabled}
        topupAmount={topupAmount}
        topupBusy={topupBusy}
        topupMsg={topupMsg}
        amount={amount}
        method={method}
        account={account}
        msg={msg}
        busy={busy}
        onTopupAmountChange={setTopupAmount}
        onTopUp={onTopUp}
        onAmountChange={setAmount}
        onMethodChange={setMethod}
        onAccountChange={setAccount}
        onWithdraw={onWithdraw}
      />
    </CustomerPageLayout>
  );
}
