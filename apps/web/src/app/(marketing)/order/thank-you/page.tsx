"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckIcon,
  CopyIcon,
  MailIcon,
  ReceiptIcon,
  StoreIcon,
  UserIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  HOME_CONTAINER_CLS,
  HOME_PAGE_BG,
} from "@/components/home/home-container";
import { ActionButton } from "@/components/ui/ActionButton";
import { getGuestOrderReceipt } from "@/lib/api";
import { endGuestCheckoutSession } from "@/lib/guest-checkout";

function ThankYouContent() {
  const searchParams = useSearchParams();
  const receiptToken = searchParams.get("token");
  const legacyOrderNumber = searchParams.get("order");
  const [orderNumber, setOrderNumber] = useState<string | null>(
    legacyOrderNumber,
  );
  const [emailMasked, setEmailMasked] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(Boolean(receiptToken));
  const [orderCopied, setOrderCopied] = useState(false);

  useEffect(() => {
    endGuestCheckoutSession();
  }, []);

  useEffect(() => {
    const token = receiptToken?.trim();
    if (!token) {
      setReceiptLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const receipt = await getGuestOrderReceipt(token);
        if (cancelled) return;
        if (receipt) {
          setOrderNumber(receipt.orderNumber);
          setEmailMasked(receipt.emailMasked);
        }
      } catch {
        /* ignore — show generic copy */
      } finally {
        if (!cancelled) {
          setReceiptLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [receiptToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("email")) return;
    url.searchParams.delete("email");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  async function copyOrderNumber() {
    if (!orderNumber) return;
    try {
      await navigator.clipboard.writeText(orderNumber);
      setOrderCopied(true);
      window.setTimeout(() => setOrderCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className={`order-thank-you-page min-h-screen py-10 sm:py-16 ${HOME_PAGE_BG}`}>
      <div className={HOME_CONTAINER_CLS}>
        <div className="order-thank-you-wrap">
          <div className="order-thank-you-glow" aria-hidden />

          <article className="order-thank-you-card">
            <header className="order-thank-you-hero">
              <div className="order-thank-you-check" aria-hidden>
                <CheckIcon className="h-9 w-9" strokeWidth={2.5} />
              </div>
              <span className="order-thank-you-badge">Payment confirmed</span>
              <h1 className="order-thank-you-title">Thank you for your order!</h1>
              <p className="order-thank-you-lead">
                Your payment was received successfully. We&apos;re preparing your
                digital delivery now.
              </p>
            </header>

            {orderNumber ? (
              <div className="order-thank-you-receipt">
                <span className="order-thank-you-receipt-icon" aria-hidden>
                  <ReceiptIcon className="h-5 w-5" />
                </span>
                <div className="order-thank-you-receipt-body">
                  <span className="order-thank-you-receipt-label">Order number</span>
                  <div className="order-thank-you-receipt-row">
                    <span className="order-thank-you-receipt-value">#{orderNumber}</span>
                    <button
                      type="button"
                      onClick={() => void copyOrderNumber()}
                      className={`order-thank-you-receipt-copy${
                        orderCopied ? " order-thank-you-receipt-copy--copied" : ""
                      }`}
                      aria-label={
                        orderCopied
                          ? "Order number copied"
                          : `Copy order number ${orderNumber}`
                      }
                      title={orderCopied ? "Copied!" : "Copy order number"}
                    >
                      {orderCopied ? (
                        <CheckIcon className="h-4 w-4" aria-hidden />
                      ) : (
                        <CopyIcon className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <ol className="order-thank-you-steps" aria-label="Order progress">
              <li className="order-thank-you-step order-thank-you-step--done">
                <span className="order-thank-you-step-dot" aria-hidden />
                <span className="order-thank-you-step-label">Payment received</span>
              </li>
              <li className="order-thank-you-step order-thank-you-step--active">
                <span className="order-thank-you-step-dot" aria-hidden />
                <span className="order-thank-you-step-label">Preparing delivery</span>
              </li>
              <li className="order-thank-you-step">
                <span className="order-thank-you-step-dot" aria-hidden />
                <span className="order-thank-you-step-label">Codes sent by email</span>
              </li>
            </ol>

            <ul className="order-thank-you-info">
              <li className="order-thank-you-info-item">
                <span className="order-thank-you-info-icon" aria-hidden>
                  <MailIcon className="h-4 w-4" />
                </span>
                <div className="order-thank-you-info-copy">
                  <span className="order-thank-you-info-title">ইমেইল নোটিফিকেশন</span>
                  <p>
                    {receiptLoading ? (
                      <>ইমেইল ঠিকানা লোড হচ্ছে…</>
                    ) : emailMasked ? (
                      <>
                        আপনার অর্ডারের ডেলিভারি সংক্রান্ত সকল ইনফরমেশন{" "}
                        <strong>{emailMasked}</strong> এই মেইলে পাঠানো হবে।
                      </>
                    ) : (
                      <>
                        আপনার অর্ডারের ডেলিভারি সংক্রান্ত সকল ইনফরমেশন
                        আপনার ইমেইলে পাঠানো হবে।
                      </>
                    )}
                  </p>
                </div>
              </li>
              <li className="order-thank-you-info-item">
                <span className="order-thank-you-info-icon order-thank-you-info-icon--accent" aria-hidden>
                  <ZapIcon className="h-4 w-4" />
                </span>
                <div className="order-thank-you-info-copy">
                  <span className="order-thank-you-info-title">ডেলিভারি সময়</span>
                  <p>
                    আপনার অর্ডার ডেলিভারি পেতে ৫–১৫ মিনিটের বেশি বিলম্ব হলে, অবশ্যই
                    অর্ডার নাম্বার নিয়ে আমাদের{" "}
                    <Link href="/support" className="order-thank-you-footer-link">
                      সাপোর্ট
                    </Link>{" "}
                    এ যোগাযোগ করতে হবে।
                  </p>
                </div>
              </li>
            </ul>

            <div className="order-thank-you-actions">
              <ActionButton
                icon={StoreIcon}
                onClick={() => {
                  window.location.href = "/products";
                }}
                className="order-thank-you-cta-primary w-full sm:w-auto"
              >
                Continue shopping
              </ActionButton>
              <Link
                href="/login"
                className="order-thank-you-cta-secondary panel-3d-btn-ghost w-full sm:w-auto"
              >
                <span className="panel-3d-btn-icon" aria-hidden>
                  <UserIcon className="h-4 w-4" />
                </span>
                <span className="panel-3d-btn-label">Sign in to track orders</span>
              </Link>
            </div>

            <p className="order-thank-you-footer">
              Questions about your order?{" "}
              <Link href="/support" className="order-thank-you-footer-link">
                Contact support
              </Link>
            </p>
          </article>
        </div>
      </div>
    </main>
  );
}

export default function OrderThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className={`order-thank-you-page min-h-screen py-16 ${HOME_PAGE_BG}`}>
          <div className={HOME_CONTAINER_CLS}>
            <p className="text-center text-sm text-foreground-muted">Loading…</p>
          </div>
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  );
}
