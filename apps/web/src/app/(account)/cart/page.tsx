"use client";
import { hasAuthSession } from "@/lib/access-token";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { CartEmptyView, CartView } from "@/components/customer/CartView";
import {
  applyCoupon,
  applyVoucher,
  getCart,
  removeCartItem,
  removeCoupon,
  removeVoucher,
  updateCartItem,
  type CartView as CartData,
} from "@/lib/api";
import { ensureShoppingSession } from "@/lib/guest-checkout";

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      if (!hasAuthSession()) {
        const ok = await ensureShoppingSession();
        if (cancelled) return;
        if (!ok) {
          router.replace("/login");
          return;
        }
      }

      getCart()
        .then((data) => {
          if (!cancelled) setCart(data);
        })
        .catch(() => {
          if (!cancelled) setCart(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    void loadCart();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function run(fn: () => Promise<CartData>, message?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const updated = await fn();
      setCart(updated);
      if (message) setMsg(message);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const currency = cart?.currency ?? "BDT";
  const empty = !cart || cart.items.length === 0;
  const msgIsError =
    msg != null && (msg.includes("failed") || msg.includes("Failed"));

  return (
    <CustomerPageLayout
      iconKey="cart"
      title="Your cart"
      backHref="/dashboard"
      section=""
      heroClassName="cart-page-hero-compact"
      loading={loading}
      loadingText="Loading cart…"
    >
      {empty ? (
        <CartEmptyView />
      ) : cart ? (
        <CartView
          cart={cart}
          currency={currency}
          busy={busy}
          couponCode={couponCode}
          voucherCode={voucherCode}
          msg={msg}
          msgIsError={msgIsError}
          onCouponCodeChange={setCouponCode}
          onVoucherCodeChange={setVoucherCode}
          onApplyCoupon={() =>
            run(() => applyCoupon(couponCode.trim()), "Coupon applied.")
          }
          onRemoveCoupon={() => run(() => removeCoupon())}
          onApplyVoucher={() =>
            run(() => applyVoucher(voucherCode.trim()), "Voucher applied.")
          }
          onRemoveVoucher={() => run(() => removeVoucher())}
          onUpdateQuantity={(productId, quantity, variationValueId) =>
            run(() => updateCartItem(productId, quantity, variationValueId))
          }
          onRemoveItem={(productId, variationValueId) =>
            run(
              () => removeCartItem(productId, variationValueId),
              "Item removed.",
            )
          }
        />
      ) : null}
    </CustomerPageLayout>
  );
}
