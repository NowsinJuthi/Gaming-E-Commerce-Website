"use client";

import { memo } from "react";
import { PriceText } from "@/components/ui/PriceText";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  CheckIcon,
  CreditCardIcon,
  ReceiptIcon,
  WalletIcon,
} from "@/components/admin/icons";
import type { OrderDetail } from "@/lib/api";

function formatPaymentMethod(method: string) {
  if (!method) return "—";
  return method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, " ");
}

function formatPaymentStatus(status: string) {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type Props = {
  order: OrderDetail;
};

function OrderPaymentPanelInner({ order }: Props) {
  const pricing = order.pricing ?? {
    subtotal: 0,
    couponDiscount: 0,
    voucherDiscount: 0,
    discountTotal: 0,
    total: 0,
    currency: "BDT",
  };
  const currency = pricing.currency ?? "BDT";
  const payment = order.payment ?? { method: "wallet", status: "pending" };
  const PaymentMethodIcon =
    payment.method === "wallet" ? WalletIcon : CreditCardIcon;

  return (
    <ProductFormOrderCard
      className="checkout-secure-card admin-product-form-section order-info-payment-card"
      icon={<ReceiptIcon className="h-4 w-4" aria-hidden />}
      title="Payment information"
      subtitle={`${formatPaymentMethod(payment.method)} · ${formatPaymentStatus(payment.status)}`}
    >
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Payment information</dt>
        <dd className="admin-product-form-basic-fields">
          <ul className="checkout-secure-list">
            <li>
              <PaymentMethodIcon className="h-4 w-4" aria-hidden />
              <span>
                Payment method:{" "}
                <strong>{formatPaymentMethod(payment.method)}</strong>
              </span>
            </li>
            <li>
              <CheckIcon className="h-4 w-4" aria-hidden />
              <span>
                Payment status:{" "}
                <strong>{formatPaymentStatus(payment.status)}</strong>
              </span>
            </li>
            {payment.paidAt ? (
              <li>
                <ReceiptIcon className="h-4 w-4" aria-hidden />
                <span>
                  Paid on:{" "}
                  <strong>
                    {new Date(payment.paidAt).toLocaleString()}
                  </strong>
                </span>
              </li>
            ) : null}
            <li>
              <ReceiptIcon className="h-4 w-4" aria-hidden />
              <span>
                Subtotal:{" "}
                <strong>
                  <PriceText amount={pricing.subtotal} currency={currency} />
                </strong>
              </span>
            </li>
            {(pricing.couponDiscount ?? 0) > 0 ? (
              <li>
                <ReceiptIcon className="h-4 w-4" aria-hidden />
                <span>
                  Coupon {pricing.couponCode}:{" "}
                  <strong className="text-emerald-400">
                    −
                    <PriceText
                      amount={pricing.couponDiscount}
                      currency={currency}
                    />
                  </strong>
                </span>
              </li>
            ) : null}
            {(pricing.voucherDiscount ?? 0) > 0 ? (
              <li>
                <ReceiptIcon className="h-4 w-4" aria-hidden />
                <span>
                  Voucher {pricing.voucherCode}:{" "}
                  <strong className="text-emerald-400">
                    −
                    <PriceText
                      amount={pricing.voucherDiscount}
                      currency={currency}
                    />
                  </strong>
                </span>
              </li>
            ) : null}
            <li className="order-info-payment-total-row">
              <PaymentMethodIcon className="h-4 w-4" aria-hidden />
              <span>
                Total:{" "}
                <strong>
                  <PriceText amount={pricing.total} currency={currency} />
                </strong>
              </span>
            </li>
            {order.refund?.refundedAt ? (
              <li>
                <ReceiptIcon className="h-4 w-4" aria-hidden />
                <span>
                  Refunded:{" "}
                  <strong>
                    <PriceText
                      amount={order.refund.amount ?? 0}
                      currency={currency}
                    />
                  </strong>
                  {order.refund.reason ? ` — ${order.refund.reason}` : ""}
                </span>
              </li>
            ) : null}
          </ul>
        </dd>
      </div>
    </ProductFormOrderCard>
  );
}

export const OrderPaymentPanel = memo(OrderPaymentPanelInner);
