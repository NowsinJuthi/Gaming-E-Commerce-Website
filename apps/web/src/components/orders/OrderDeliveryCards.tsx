"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon, CopyIcon } from "@/components/admin/icons";
import { OrderDeliveryProductIcon } from "@/components/orders/OrderDeliveryProductIcon";
import { type OrderDeliveredCode, type OrderLine } from "@/lib/api";
import {
  formatOrderPackageLabel,
  orderLineQuantity,
  parseOrderItemPackage,
  resolveGiftCardAmountForOrderItem,
  resolveOrderDetailsFieldTitle,
} from "@/lib/admin-order-view";
import { resolveGiftCardAmountDisplay } from "@/lib/inventory-packages";
import { loadOrderItemImage } from "@/lib/order-product-images";
import { productPath } from "@/lib/seo";

type CodeLine = {
  key: string;
  title: string;
  slug: string;
  entry: OrderDeliveredCode;
  copyValue: string;
  code: string;
  amount?: string;
  pin?: string;
};

function orderItemProductTitle(title: string): string {
  return parseOrderItemPackage(title).productTitle;
}

const CODE_AMOUNT_SEPARATOR = " · ";

function formatCodeLineAmount(
  item: OrderLine,
  giftAmount?: string,
): string | undefined {
  const fromGift = giftAmount?.trim()
    ? resolveGiftCardAmountDisplay(giftAmount)
    : "";
  if (fromGift) return fromGift;

  const fromItem = resolveGiftCardAmountForOrderItem(item);
  return fromItem || undefined;
}

function parseDeliveredCodeDisplay(
  entry: OrderDeliveredCode,
  item: OrderLine,
  giftAmount?: string,
): Pick<CodeLine, "copyValue" | "code" | "amount" | "pin"> {
  let code = entry.code?.trim() ?? "";
  let amount = formatCodeLineAmount(item, giftAmount);

  if (!amount) {
    const sepIndex = code.lastIndexOf(CODE_AMOUNT_SEPARATOR);
    if (sepIndex !== -1) {
      const possibleCode = code.slice(0, sepIndex).trim();
      const possibleAmount = code.slice(sepIndex + CODE_AMOUNT_SEPARATOR.length).trim();
      if (possibleCode && possibleAmount) {
        code = possibleCode;
        amount = resolveGiftCardAmountDisplay(possibleAmount) || undefined;
      }
    }
  }

  const pin = entry.pin?.trim() || undefined;
  const copyValue = pin ? `${code}\nPIN: ${pin}` : code;

  return { copyValue, code, amount, pin };
}

function buildCodeLines(
  items: OrderLine[],
  giftCards?: Array<{ code?: string; amount?: string }>,
): CodeLine[] {
  const lines: CodeLine[] = [];
  let giftCardIndex = 0;

  for (const item of items) {
    for (const [index, entry] of (item.deliveredCodes ?? []).entries()) {
      const parsed = parseDeliveredCodeDisplay(
        entry,
        item,
        giftCards?.[giftCardIndex]?.amount,
      );
      giftCardIndex += 1;
      lines.push({
        key: `${item.productId}-${index}`,
        title: orderItemProductTitle(item.title),
        slug: item.slug,
        entry,
        ...parsed,
      });
    }
  }

  if (lines.length > 0) return lines;

  if (giftCards?.length) {
    const primaryItem = items[0];
    return giftCards
      .filter((card) => card.code?.trim())
      .map((card, index) => {
        const parsed = parseDeliveredCodeDisplay(
          { code: card.code!.trim() },
          primaryItem ?? {
            productId: "",
            title: "Gift card",
            slug: "",
            unitPrice: 0,
            quantity: 1,
            lineTotal: 0,
            deliveryType: "auto",
            delivered: true,
          },
          card.amount,
        );
        return {
          key: `gift-${index}`,
          title: primaryItem
            ? orderItemProductTitle(primaryItem.title)
            : "Gift card",
          slug: primaryItem?.slug ?? "",
          entry: { code: card.code!.trim() },
          ...parsed,
        };
      });
  }

  return lines;
}

function CopyCodeButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`admin-order-view-icon-btn${copied ? " admin-order-view-icon-btn--copied" : ""}`}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied!" : label}
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

type Props = {
  items: OrderLine[];
  giftCards?: Array<{ code?: string; amount?: string; fieldLabel?: string }>;
  embedded?: boolean;
};

export function OrderDeliveryCards({
  items,
  giftCards,
  embedded = false,
}: Props) {
  const codeLines = buildCodeLines(items, giftCards);
  const primaryItem = items[0];
  const primaryPackageLabel =
    items.length === 1 && primaryItem
      ? formatOrderPackageLabel(primaryItem.title)
      : null;
  const hasCodes = codeLines.length > 0;
  const allDelivered = items.every((item) => item.delivered);
  const detailsFieldTitle = resolveOrderDetailsFieldTitle(giftCards);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!primaryItem?.slug) {
      setPrimaryImageUrl(undefined);
      return;
    }

    let cancelled = false;

    void loadOrderItemImage(
      `${primaryItem.productId}::0`,
      primaryItem.slug,
      primaryItem.title,
    ).then((url) => {
      if (!cancelled) setPrimaryImageUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [primaryItem?.productId, primaryItem?.slug, primaryItem?.title]);

  const content = (
    <dl className="admin-order-view-detail-list admin-order-view-detail-list--in-panel">
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Product</dt>
        <dd>
          {items.length === 1 && primaryItem ? (
            <div className="admin-order-view-delivery-product">
              <OrderDeliveryProductIcon
                title={primaryItem.title}
                slug={primaryItem.slug}
                plain={embedded}
                imageUrl={primaryImageUrl}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={productPath(primaryItem.slug)}
                  className="admin-order-view-delivery-product-title"
                >
                  {orderItemProductTitle(primaryItem.title)}
                </Link>
                {primaryPackageLabel ? (
                  <p className="admin-order-view-delivery-product-package">
                    {primaryPackageLabel}
                  </p>
                ) : null}
                <p className="admin-order-view-delivery-product-qty">
                  Quantity:{" "}
                  <strong>{orderLineQuantity(primaryItem.quantity)}</strong>
                </p>
              </div>
            </div>
          ) : (
            <ul className="admin-order-view-delivery-product-list space-y-3">
              {items.map((item, index) => {
                const packageLabel = formatOrderPackageLabel(item.title);
                return (
                  <li
                    key={`${item.productId}-${index}`}
                    className="admin-order-view-delivery-product"
                  >
                    <OrderDeliveryProductIcon
                      title={item.title}
                      slug={item.slug}
                      plain={embedded}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={productPath(item.slug)}
                        className="admin-order-view-delivery-product-title"
                      >
                        {orderItemProductTitle(item.title)}
                      </Link>
                      {packageLabel ? (
                        <p className="admin-order-view-delivery-product-package">
                          {packageLabel}
                        </p>
                      ) : null}
                      <p className="admin-order-view-delivery-product-qty">
                        Quantity:{" "}
                        <strong>{orderLineQuantity(item.quantity)}</strong>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </dd>
      </div>

      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked admin-order-view-delivery-details-row">
        <dt>
          Details
          {detailsFieldTitle ? (
            <span className="admin-order-view-delivery-details-kicker">
              {" "}
              · {detailsFieldTitle}
            </span>
          ) : null}
        </dt>
        <dd>
          {hasCodes ? (
            <div className="admin-order-view-gift-list">
              {codeLines.map((line, index) => (
                <div
                  key={line.key}
                  className={`admin-order-view-gift-row admin-order-view-gift-row--delivery${line.amount ? "" : " admin-order-view-gift-row--delivery-no-amount"}`}
                >
                  <div className="min-w-0">
                    {items.length > 1 ? (
                      <p className="admin-order-view-delivery-code-product">
                        {line.title}
                      </p>
                    ) : null}
                    <div className="admin-order-view-input admin-order-view-input--readonly font-mono text-brand">
                      {line.code}
                      {line.pin ? (
                        <span className="font-sans text-foreground-muted">
                          {" "}
                          · PIN: {line.pin}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {line.amount ? (
                    <div className="admin-order-view-input admin-order-view-input--sm admin-order-view-input--readonly">
                      {line.amount}
                    </div>
                  ) : null}
                  <CopyCodeButton
                    value={line.copyValue}
                    label={`Copy code line ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-order-view-input admin-order-view-input--readonly admin-order-view-input--pending">
              {allDelivered
                ? "Delivered — codes will appear here"
                : "Pending delivery"}
            </div>
          )}
        </dd>
      </div>
    </dl>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="order-delivery-section">
      <div className="order-delivery-head">
        <h2 className="order-delivery-title">Delivery information</h2>
      </div>
      <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
        {content}
      </div>
    </div>
  );
}
