"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon } from "@/components/admin/icons";
import {
  CheckoutView,
  type CheckoutContact,
} from "@/components/checkout/CheckoutView";
import {
  ApiError,
  createOrder,
  createPayment,
  getCartFresh,
  getCustomerPanelConfig,
  getMe,
  getWallet,
  payOrder,
  resolveOrderId,
  type CartView,
  type CustomerPanelConfig,
  type PaymentMethodValue,
  type UserProfile,
  type Wallet,
} from "@/lib/api";
import {
  getPostOrderRedirectPath,
} from "@/lib/post-order";
import {
  checkoutMethodsFromConfig,
  paymentMethodOrderFromConfig,
  resolveDefaultPaymentMethod,
} from "@/lib/checkout-payment-methods";
import {
  endGuestCheckoutSession,
  ensureShoppingSession,
  isGuestCheckoutSession,
  isRegisteredUserLoggedIn,
} from "@/lib/guest-checkout";
import { toast } from "@/stores/toast-store";

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartView | null>(null);
  const [config, setConfig] = useState<CustomerPanelConfig | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodValue>("gateway");
  const [orderNote, setOrderNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const orderInFlightRef = useRef(false);

  useEffect(() => {
    function onAuthChange() {
      void getCartFresh()
        .then((fresh) => setCart(fresh))
        .catch(() => setCart(null));
    }
    window.addEventListener("auth-change", onAuthChange);
    return () => window.removeEventListener("auth-change", onAuthChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(sessionRetried = false) {
      setLoading(true);
      setLoadError(null);
      try {
        const [cartResult, configResult, profileResult, walletResult] =
          await Promise.allSettled([
            getCartFresh(),
            getCustomerPanelConfig(),
            getMe(),
            getWallet(),
          ]);

        if (cancelled) return;

        if (cartResult.status === "fulfilled") {
          setCart(cartResult.value);
        } else {
          if (
            !sessionRetried &&
            cartResult.reason instanceof ApiError &&
            cartResult.reason.status === 401
          ) {
            const ok = await ensureShoppingSession();
            if (ok && !cancelled) {
              void load(true);
              return;
            }
          }
          setCart(null);
          setLoadError(
            cartResult.reason instanceof Error
              ? cartResult.reason.message
              : "Could not load your cart. Check that you are logged in and the API is running.",
          );
        }

        if (configResult.status === "fulfilled") {
          setConfig(configResult.value);
          setPaymentMethod(() => {
            const guest = isGuestCheckoutSession();
            const methods = checkoutMethodsFromConfig(configResult.value);
            if (guest) methods.walletEnabled = false;
            const order = paymentMethodOrderFromConfig(configResult.value);
            return (
              resolveDefaultPaymentMethod(methods, "gateway", order) ?? "gateway"
            );
          });
        }

        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value);
        }

        if (walletResult.status === "fulfilled") {
          setWallet(walletResult.value);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPlaceOrder(contact: CheckoutContact) {
    if (orderInFlightRef.current) return;
    orderInFlightRef.current = true;
    setPlacing(true);
    setMsg(null);
    const loggedIn = isRegisteredUserLoggedIn();

    try {
      let liveCart: CartView;
      try {
        liveCart = await getCartFresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && !loggedIn) {
          throw new Error(
            "Your session expired. Please go back to the cart and try again.",
          );
        }
        throw err;
      }

      setCart(liveCart);
      if (liveCart.items.length === 0) {
        throw new Error(
          "Your cart is empty or your session changed. Open the cart page, confirm your items, then checkout again.",
        );
      }

      const order = await createOrder({
        paymentMethod,
        note: orderNote.trim() || undefined,
        contact,
      });
      const orderId = resolveOrderId(order);
      if (!orderId) {
        throw new Error("Order was created but no order id was returned.");
      }

      if (paymentMethod === "wallet") {
        let paidOrder = order;
        try {
          paidOrder = await payOrder(orderId);
        } catch (err) {
          const errMsg =
            err instanceof Error
              ? `Order placed; payment issue: ${err.message}`
              : "Order placed; payment issue";
          setMsg(errMsg);
          toast(errMsg, "error");
          return;
        }
        window.dispatchEvent(new Event("cart-change"));
        if (!loggedIn) {
          endGuestCheckoutSession();
        }
        router.push(
          getPostOrderRedirectPath(paidOrder, {
            loggedIn,
            guestReceiptToken:
              paidOrder.guestReceiptToken ?? order.guestReceiptToken,
          }),
        );
        return;
      }

      if (paymentMethod === "gateway") {
        let payment;
        try {
          payment = await createPayment({
            gateway: "mfs",
            purpose: "order",
            orderId,
            amount: order.pricing.total,
            currency: order.pricing.currency ?? currency,
            idempotencyKey: `order-mfs-${orderId}`,
          });
        } catch (payErr) {
          window.dispatchEvent(new Event("cart-change"));
          const payMsg =
            payErr instanceof Error
              ? payErr.message
              : "Could not start payment";
          const recoveryMsg = order.orderNumber
            ? `Order ${order.orderNumber} was placed, but payment could not start: ${payMsg}. Open Orders to pay or contact support.`
            : `Your order was placed, but payment could not start: ${payMsg}. Open Orders to pay or contact support.`;
          setMsg(recoveryMsg);
          toast(recoveryMsg, "error");
          router.push(`/orders/${orderId}`);
          return;
        }
        window.dispatchEvent(new Event("cart-change"));
        if (payment.checkoutUrl && /^https?:\/\//i.test(payment.checkoutUrl)) {
          window.location.href = payment.checkoutUrl;
        } else {
          router.push(`/checkout/pay/${payment.intentId}`);
        }
        return;
      }

      window.dispatchEvent(new Event("cart-change"));
      if (!loggedIn) {
        endGuestCheckoutSession();
      }
      router.push(
        getPostOrderRedirectPath(order, {
          loggedIn,
          guestReceiptToken: order.guestReceiptToken,
        }),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        if (!isRegisteredUserLoggedIn()) {
          const renewed = await ensureShoppingSession();
          if (renewed) {
            try {
              const refreshed = await getCartFresh();
              setCart(refreshed);
            } catch {
              /* ignore */
            }
            setMsg(
              "Your session was renewed. Please try placing your order again.",
            );
            toast("Session renewed — please try again.", "error");
            return;
          }
        }
        router.push(`/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }
      const errMsg = err instanceof Error ? err.message : "Checkout failed";
      setMsg(errMsg);
      toast(errMsg, "error");
    } finally {
      orderInFlightRef.current = false;
      setPlacing(false);
    }
  }

  const empty = !loadError && (!cart || cart.items.length === 0);
  const currency = cart?.currency ?? config?.storefront.defaultCurrency ?? "BDT";
  const checkoutConfig = useMemo(() => {
    if (!config || !isGuestCheckoutSession()) return config;
    return {
      ...config,
      checkout: {
        ...config.checkout,
        walletEnabled: false,
      },
    };
  }, [config]);

  if (loading) {
    return (
      <div className="checkout-page">
        <p className="dashboard-loading py-16">Loading checkout…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="checkout-page space-y-4">
        <Link href="/cart" className="checkout-back">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          Back to cart
        </Link>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {loadError}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Try again
          </button>
          <Link href="/cart" className="dashboard-pro-btn-ghost inline-flex">
            Back to cart
          </Link>
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="checkout-page space-y-4">
        <Link href="/cart" className="checkout-back">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          Back to cart
        </Link>
        <div className="shell-panel border-dashed p-10 text-center">
          <p className="text-sm text-foreground-muted">Your cart is empty.</p>
          <Link href="/products" className="btn-primary mt-4 inline-flex">
            Shop now
          </Link>
        </div>
      </div>
    );
  }

  if (!cart) return null;

  return (
    <CheckoutView
      cart={cart}
      config={checkoutConfig}
      profile={profile}
      wallet={wallet}
      currency={currency}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={setPaymentMethod}
      orderNote={orderNote}
      onOrderNoteChange={setOrderNote}
      onCartChange={setCart}
      onPlaceOrder={onPlaceOrder}
      placing={placing}
      message={msg}
    />
  );
}
