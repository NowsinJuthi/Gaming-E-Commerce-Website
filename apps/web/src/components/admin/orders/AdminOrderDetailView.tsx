"use client";

import Link from "next/link";
import { PriceText } from "@/components/ui/PriceText";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  BoxIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  CopyIcon,
  CreditCardIcon,
  MailIcon,
  PhoneIcon,
  ReceiptIcon,
  TrashIcon,
  TruckIcon,
  UserIcon,
  WalletIcon,
} from "@/components/admin/icons";
import type { CustomOrderField } from "@/components/admin/custom-order-fields-editor";
import type { SavedDeliveryNote } from "@/components/admin/saved-delivery-notes-editor";
import { listSavedDeliveryNoteOptions } from "@/components/admin/saved-delivery-notes-editor";
import {
  EMAIL_SENDER_CHANNEL_OPTIONS,
  type AdminCustomerRow,
  type EmailSenderChannel,
  type OrderDetail,
  type OrderStatusValue,
} from "@/lib/api";
import {
  ADMIN_ORDER_DETAIL_STATUS_STYLE,
  ADMIN_ORDER_STATUS_LABELS,
  adminOrderOrigin,
} from "@/lib/admin-order-ui";
import {
  formatAdminPaymentDate,
  formatAdminPaymentMethod,
  formatAdminPaymentStatus,
} from "@/lib/admin-payment-ui";
import {
  ADMIN_ORDER_STATUS_OPTIONS,
  buildAutoMessageOneFromSelection,
  buildAdminDeliveryFieldOptions,
  hydrateManualGiftDeliveryFromOrder,
  resolveDeliveryFieldBoxTitle,
  resolveSelectedDeliveryOptions,
  formatAdminPaymentWhen,
  getCustomerDisplayName,
  orderLineQuantity,
  parseOrderItemPackage,
  parseDeliveryFieldOptionProductName,
  resolveGiftCardAmountForOrderItem,
  resolveDeliveryMessageProducts,
  type AdminCustomerOrderHistory,
  type AdminOrderCompletePayload,
  type AdminOrderGiftCardRow,
} from "@/lib/admin-order-view";
import { resolveGiftCardAmountDisplay } from "@/lib/inventory-packages";
import { ManualDeliveryStockPicker } from "@/components/admin/orders/ManualDeliveryStockPicker";

type Props = {
  order: OrderDetail;
  customer: AdminCustomerRow | null;
  customerHistory: AdminCustomerOrderHistory;
  productThumbs: Record<string, string>;
  productRegionsByLineKey?: Record<string, string[]>;
  productAttributesByProductId?: Record<
    string,
    Record<string, unknown> | undefined
  >;
  productDeliveryTypeByProductId?: Record<string, string | undefined>;
  deliveryFields: CustomOrderField[];
  savedDeliveryNotes: SavedDeliveryNote[];
  statusDraft: OrderStatusValue;
  onStatusDraftChange: (status: OrderStatusValue) => void;
  onUpdateStatus: () => void;
  onMoveToTrash: () => void;
  onTrash: () => void;
  onSaveManualDelivery: (
    payload: Pick<AdminOrderCompletePayload, "deliveryMessage" | "giftCards">,
  ) => void;
  onCompleteOrder: (payload: AdminOrderCompletePayload) => void;
  onSendNote: (message: string, emailChannel: EmailSenderChannel) => void;
  busy?: boolean;
  /** Custom label for the "gateway" payment method (e.g. "bKash / Nagad / Rocket"). */
  gatewayLabel?: string;
};

const EMPTY_PRODUCT_REGIONS_BY_LINE_KEY: Record<string, string[]> = {};
const EMPTY_PRODUCT_ATTRIBUTES_BY_PRODUCT_ID: Record<
  string,
  Record<string, unknown> | undefined
> = {};

function CollapsibleCard({
  title,
  subtitle,
  icon,
  className = "",
  headerClassName = "",
  children,
  mobileCollapsible = false,
  defaultMobileOpen = false,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  className?: string;
  headerClassName?: string;
  children: ReactNode;
  /** Show expand/collapse toggle on the header right — mobile only. */
  mobileCollapsible?: boolean;
  defaultMobileOpen?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(defaultMobileOpen);

  return (
    <section
      className={`dashboard-pro-card admin-order-view-card ${className}`.trim()}
    >
      <div
        className={`dashboard-pro-section-head admin-order-view-card-header ${headerClassName}${
          mobileCollapsible ? " admin-order-view-card-header--mobile-toggle" : ""
        }`.trim()}
      >
        <span className="dashboard-pro-section-icon" aria-hidden>
          {icon}
        </span>
        <div className="admin-order-view-section-copy min-w-0 flex-1">
          <h2 className="dashboard-pro-section-title">{title}</h2>
          {subtitle ? (
            <p className="dashboard-pro-section-sub">{subtitle}</p>
          ) : null}
        </div>
        {mobileCollapsible ? (
          <button
            type="button"
            className="admin-order-view-mobile-toggle sm:hidden"
            aria-expanded={mobileOpen}
            aria-label={
              mobileOpen ? `Collapse ${title}` : `Expand ${title}`
            }
            onClick={() => setMobileOpen((open) => !open)}
          >
            <ChevronIcon
              className={`h-4 w-4 transition-transform${
                mobileOpen ? " rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      <div
        className={`admin-order-view-card-body${
          mobileCollapsible && !mobileOpen ? " max-sm:hidden" : ""
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function CustomerHistoryCard({
  customerHistory,
  currency,
  className = "",
}: {
  customerHistory: Props["customerHistory"];
  currency: string;
  className?: string;
}) {
  return (
    <CollapsibleCard
      className={`admin-order-view-sidebar-card admin-order-view-sidebar-card--history admin-order-view-sidebar-card--pro ${className}`.trim()}
      headerClassName="admin-order-view-pro-section-head"
      title="Customer history"
      icon={<ReceiptIcon className="h-4 w-4" />}
      mobileCollapsible
    >
      <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dl className="admin-order-view-detail-list admin-order-view-detail-list--in-panel">
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Total orders</dt>
            <dd>{customerHistory.totalOrders}</dd>
          </div>
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Total revenue</dt>
            <dd className="admin-order-view-detail-value--revenue">
              <PriceText amount={customerHistory.totalRevenue} currency={currency} />
            </dd>
          </div>
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Average order value</dt>
            <dd className="admin-order-view-detail-value--avg">
              <PriceText
                amount={customerHistory.averageOrderValue}
                currency={currency}
              />
            </dd>
          </div>
        </dl>
      </div>
    </CollapsibleCard>
  );
}

function OrderOriginCard({
  order,
  className = "",
}: {
  order: Props["order"];
  className?: string;
}) {
  return (
    <CollapsibleCard
      className={`admin-order-view-sidebar-card admin-order-view-sidebar-card--origin admin-order-view-sidebar-card--pro ${className}`.trim()}
      headerClassName="admin-order-view-pro-section-head"
      title="Order origin"
      icon={<BoxIcon className="h-4 w-4" />}
      mobileCollapsible
    >
      <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dl className="admin-order-view-detail-list admin-order-view-detail-list--in-panel">
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Origin</dt>
            <dd>
              {order.origin?.channel ??
                adminOrderOrigin(order.payment.method)}
            </dd>
          </div>
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Customer IP</dt>
            <dd>{order.origin?.customerIp ?? "—"}</dd>
          </div>
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Device</dt>
            <dd>{order.origin?.device ?? "—"}</dd>
          </div>
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Browser</dt>
            <dd>{order.origin?.browser ?? "—"}</dd>
          </div>
          <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
            <dt>Operating system</dt>
            <dd>{order.origin?.operatingSystem ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </CollapsibleCard>
  );
}

function OrderOverviewStat({
  tone,
  metaTone,
  icon,
  label,
  value,
  meta,
}: {
  tone: "brand" | "success" | "amber" | "muted";
  metaTone?: "brand" | "success" | "amber" | "muted";
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta?: string;
}) {
  return (
    <div className={`admin-order-overview-stat admin-order-overview-stat--${tone}`}>
      <span className="admin-order-overview-stat-glow" aria-hidden />
      <span className="admin-order-overview-stat-icon" aria-hidden>
        {icon}
      </span>
      <div className="admin-order-overview-stat-copy min-w-0">
        <dt className="admin-order-overview-stat-label">{label}</dt>
        <dd className="admin-order-overview-stat-value">{value}</dd>
        {meta ? (
          <p
            className={`admin-order-overview-stat-meta${
              metaTone ? ` admin-order-overview-stat-meta--${metaTone}` : ""
            }`}
          >
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OrderOverviewCopyValue({
  text,
  copyKey,
  copiedKey,
  onCopy,
  emptyLabel = "—",
}: {
  text: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
  emptyLabel?: string;
}) {
  if (!text || text === emptyLabel) {
    return <>{emptyLabel}</>;
  }

  const copied = copiedKey === copyKey;

  return (
    <span className="admin-order-overview-stat-value-row">
      <span className="min-w-0 break-all">{text}</span>
      <button
        type="button"
        onClick={() => onCopy(copyKey, text)}
        className={`admin-order-overview-stat-copy-btn${
          copied ? " admin-order-overview-stat-copy-btn--copied" : ""
        }`}
        aria-label={copied ? "Copied" : `Copy ${copyKey}`}
        title={copied ? "Copied!" : "Copy"}
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </span>
  );
}

function OrderItemCustomerInputField({
  label,
  value,
  fieldKey,
  copiedKey,
  onCopy,
}: {
  label: string;
  value: string;
  fieldKey: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const trimmed = value.trim();
  const copied = copiedKey === fieldKey;

  return (
    <div className="order-info-items-list-input">
      <p className="order-info-items-list-input-label">{label}</p>
      <div className="admin-order-view-item-customer-input-value-row">
        <div className="admin-order-view-input admin-order-view-input--readonly min-w-0 flex-1 text-xs">
          {value}
        </div>
        {trimmed ? (
          <button
            type="button"
            onClick={() => onCopy(fieldKey, trimmed)}
            className={`admin-order-view-icon-btn admin-order-view-item-customer-input-copy-btn${
              copied ? " admin-order-view-icon-btn--copied" : ""
            }`}
            aria-label={copied ? "Copied" : `Copy ${label}`}
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OrderItemsCustomerSection({
  customerName,
  customer,
  contact,
}: {
  customerName: string;
  customer: AdminCustomerRow | null;
  contact: OrderDetail["contact"];
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const phone =
    contact?.mobile?.trim() || customer?.phone?.trim() || "—";
  const email = contact?.email?.trim() || customer?.email?.trim() || "—";

  async function copyContactField(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <section
      className="admin-order-view-items-customer admin-order-view-overview-section"
      aria-label="Customer details"
    >
      <header className="admin-order-overview-panel-head">
        <span className="admin-order-overview-panel-icon" aria-hidden>
          <UserIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="admin-order-overview-panel-title">Customer details</h3>
          <p className="admin-order-overview-panel-sub">
            {contact?.fullName?.trim() || customerName || "Guest customer"}
          </p>
        </div>
        {customer ? (
          <Link
            href={`/admin/customers?customer=${customer.id}`}
            className="admin-order-view-items-customer-action shrink-0"
          >
            View customer →
          </Link>
        ) : null}
      </header>
      <dl className="admin-order-overview-stats admin-order-overview-panel--fields">
        <OrderOverviewStat
          tone="brand"
          icon={<UserIcon className="h-4 w-4" aria-hidden />}
          label="Customer Name"
          value={contact?.fullName?.trim() || customerName || "—"}
        />
        <OrderOverviewStat
          tone="brand"
          icon={<PhoneIcon className="h-4 w-4" aria-hidden />}
          label="Contact Number"
          value={
            <OrderOverviewCopyValue
              text={phone}
              copyKey="phone"
              copiedKey={copiedField}
              onCopy={copyContactField}
            />
          }
        />
        <OrderOverviewStat
          tone="brand"
          icon={<MailIcon className="h-4 w-4" aria-hidden />}
          label="Contact Email"
          value={
            <OrderOverviewCopyValue
              text={email}
              copyKey="email"
              copiedKey={copiedField}
              onCopy={copyContactField}
            />
          }
        />
      </dl>
    </section>
  );
}

function OrderItemsPaymentSection({
  order,
  gatewayLabel,
  className = "",
}: {
  order: OrderDetail;
  gatewayLabel?: string;
  className?: string;
}) {
  const currency = order.pricing.currency;
  const paymentStatus = order.payment.status || "pending";
  const mfs = order.payment.mfs;
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const PaymentIcon =
    order.payment.method === "wallet" ? WalletIcon : CreditCardIcon;
  const paymentMethodLabel =
    order.payment.method === "gateway" && gatewayLabel
      ? gatewayLabel
      : formatAdminPaymentMethod(order.payment.method);
  const sender = mfs?.sender?.trim() || "—";
  const trxId = mfs?.trxId?.trim() || "—";
  const paymentMobile = mfs?.senderMobile?.trim() || "—";
  const paidOn = formatAdminPaymentDate(
    order.payment.paidAt,
    order.createdAt,
  );

  async function copyPaymentField(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <section
      className={`admin-order-view-payment-overview admin-order-view-overview-section ${className}`.trim()}
      aria-label="Payment details"
    >
      <div className="admin-order-overview-panel admin-order-overview-panel--fields">
        <header
          className="admin-order-overview-panel-head admin-order-view-card-header--mobile-toggle"
        >
          <span className="admin-order-overview-panel-icon" aria-hidden>
            <PaymentIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="admin-order-overview-panel-title">Payment details</h3>
            <p className="admin-order-overview-panel-sub">
              {paymentMethodLabel} · {formatAdminPaymentStatus(paymentStatus)}
            </p>
          </div>
          <button
            type="button"
            className="admin-order-view-mobile-toggle sm:hidden"
            aria-expanded={mobileOpen}
            aria-label={
              mobileOpen ? "Collapse Payment details" : "Expand Payment details"
            }
            onClick={() => setMobileOpen((open) => !open)}
          >
            <ChevronIcon
              className={`h-4 w-4 transition-transform${
                mobileOpen ? " rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        </header>
        <dl
          className={`admin-order-overview-stats${
            !mobileOpen ? " max-sm:hidden" : ""
          }`}
        >
          <OrderOverviewStat
            tone="brand"
            icon={<PaymentIcon className="h-4 w-4" aria-hidden />}
            label="Payment"
            value={paymentMethodLabel}
          />
          <OrderOverviewStat
            tone="brand"
            icon={<PhoneIcon className="h-4 w-4" aria-hidden />}
            label="Payment Mobile"
            value={
              <OrderOverviewCopyValue
                text={paymentMobile}
                copyKey="paymentMobile"
                copiedKey={copiedField}
                onCopy={copyPaymentField}
              />
            }
          />
          <OrderOverviewStat
            tone="brand"
            icon={<MailIcon className="h-4 w-4" aria-hidden />}
            label="Sender"
            value={sender}
          />
          <OrderOverviewStat
            tone="brand"
            icon={<ReceiptIcon className="h-4 w-4" aria-hidden />}
            label="TrxID"
            value={
              <OrderOverviewCopyValue
                text={trxId}
                copyKey="trxId"
                copiedKey={copiedField}
                onCopy={copyPaymentField}
              />
            }
          />
          <OrderOverviewStat
            tone="brand"
            icon={<CheckIcon className="h-4 w-4" aria-hidden />}
            label="Paid on"
            value={paidOn}
          />
          {(order.pricing.couponDiscount ?? 0) > 0 ? (
            <OrderOverviewStat
              tone="brand"
              icon={<ReceiptIcon className="h-4 w-4" aria-hidden />}
              label={
                order.pricing.couponCode
                  ? `Coupon (${order.pricing.couponCode})`
                  : "Coupon"
              }
              value={
                <>
                  −
                  <PriceText
                    amount={order.pricing.couponDiscount}
                    currency={currency}
                  />
                </>
              }
            />
          ) : null}
          {(order.pricing.voucherDiscount ?? 0) > 0 ? (
            <OrderOverviewStat
              tone="brand"
              icon={<ReceiptIcon className="h-4 w-4" aria-hidden />}
              label={
                order.pricing.voucherCode
                  ? `Voucher (${order.pricing.voucherCode})`
                  : "Voucher"
              }
              value={
                <>
                  −
                  <PriceText
                    amount={order.pricing.voucherDiscount}
                    currency={currency}
                  />
                </>
              }
            />
          ) : null}
          {order.refund?.refundedAt ? (
            <OrderOverviewStat
              tone="brand"
              icon={<ReceiptIcon className="h-4 w-4" aria-hidden />}
              label="Refunded"
              value={
                <>
                  <PriceText
                    amount={order.refund.amount ?? 0}
                    currency={currency}
                  />
                  {order.refund.reason ? ` — ${order.refund.reason}` : ""}
                </>
              }
            />
          ) : null}
        </dl>
      </div>
    </section>
  );
}

function newGiftRow(deliveryFieldId?: string): AdminOrderGiftCardRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: "",
    amount: "",
    deliveryFieldId,
  };
}

export function AdminOrderDetailView({
  order,
  customer,
  customerHistory,
  productThumbs,
  productRegionsByLineKey = EMPTY_PRODUCT_REGIONS_BY_LINE_KEY,
  productAttributesByProductId = EMPTY_PRODUCT_ATTRIBUTES_BY_PRODUCT_ID,
  deliveryFields,
  savedDeliveryNotes,
  statusDraft,
  onStatusDraftChange,
  onUpdateStatus,
  onMoveToTrash,
  onTrash,
  onSaveManualDelivery,
  onCompleteOrder,
  onSendNote,
  busy = false,
  gatewayLabel,
}: Props) {
  const currency = order.pricing.currency;
  const hasManualItems = order.items.some((it) => it.deliveryType === "manual");
  const orderRegions = useMemo(() => {
    const seen = new Set<string>();
    const regions: string[] = [];
    for (const item of order.items) {
      const lineKey = `${item.productId}::${item.variationValueId ?? ""}`;
      for (const region of productRegionsByLineKey[lineKey] ?? []) {
        const code = region.trim().toUpperCase();
        if (!code || seen.has(code)) continue;
        seen.add(code);
        regions.push(code);
      }
    }
    return regions;
  }, [order.items, productRegionsByLineKey]);
  const baseDeliveryFieldOptions = useMemo(
    () =>
      buildAdminDeliveryFieldOptions(
        deliveryFields,
        orderRegions,
        hasManualItems,
      ),
    [deliveryFields, orderRegions, hasManualItems],
  );
  const savedNoteOptions = listSavedDeliveryNoteOptions(savedDeliveryNotes);
  const showManualDelivery =
    hasManualItems || baseDeliveryFieldOptions.length > 0;
  const savedGiftCardsKey = JSON.stringify(order.manualGiftCards ?? []);
  const deliveredCodesKey = order.items
    .map(
      (item) =>
        item.deliveredCodes?.map((entry) => entry.code).join(",") ?? "",
    )
    .join("|");
  const deliveryOptionsKey = baseDeliveryFieldOptions
    .map((opt) => `${opt.id}:${opt.label}`)
    .join("|");
  const orderNote = order.timeline.find((t) => t.status === "pending")?.note;
  const deliveryMessageProducts = useMemo(
    () => resolveDeliveryMessageProducts(order, productThumbs),
    [order, productThumbs],
  );
  const contact = order.contact;
  const customerName = customer
    ? getCustomerDisplayName(customer, contact)
    : contact?.fullName?.trim() || "Guest";

  const [selectedDeliveryFields, setSelectedDeliveryFields] = useState<string[]>(
    [],
  );
  const [copiedCustomerInputKey, setCopiedCustomerInputKey] = useState<
    string | null
  >(null);
  const [giftRowsByField, setGiftRowsByField] = useState<
    Record<string, AdminOrderGiftCardRow[]>
  >({});
  const [customerNote, setCustomerNote] = useState("");
  const [noteSenderChannel, setNoteSenderChannel] =
    useState<EmailSenderChannel>("orders");
  const [selectedSavedNoteId, setSelectedSavedNoteId] = useState("");
  const [deliveryMessageDismissed, setDeliveryMessageDismissed] =
    useState(false);
  const customerEmail =
    contact?.email?.trim() || customer?.email?.trim() || "";

  const deliveryFieldOptions = useMemo(() => {
    const extras = selectedDeliveryFields
      .filter((id) => id.startsWith("saved:"))
      .filter((id) => !baseDeliveryFieldOptions.some((opt) => opt.id === id))
      .map((id) => ({
        id,
        label: id.slice("saved:".length),
      }));
    return [...baseDeliveryFieldOptions, ...extras];
  }, [baseDeliveryFieldOptions, selectedDeliveryFields]);

  const selectedOptions = resolveSelectedDeliveryOptions(
    selectedDeliveryFields,
    deliveryFieldOptions,
  );

  const allGiftRows = useMemo(
    () =>
      selectedDeliveryFields.flatMap(
        (fieldId) => giftRowsByField[fieldId] ?? [],
      ),
    [selectedDeliveryFields, giftRowsByField],
  );

  const usedInventoryIds = useMemo(
    () =>
      new Set(
        allGiftRows
          .map((row) => row.inventoryItemId)
          .filter((id): id is string => Boolean(id)),
      ),
    [allGiftRows],
  );

  const stockTargetFieldId = selectedDeliveryFields[0] ?? null;

  function updateGiftRowsForSelection(next: string[]) {
    const added = next.filter((id) => !selectedDeliveryFields.includes(id));
    const removed = selectedDeliveryFields.filter((id) => !next.includes(id));

    for (const fieldId of removed) {
      setGiftRowsByField((rows) => {
        const copy = { ...rows };
        delete copy[fieldId];
        return copy;
      });
    }

    for (const fieldId of added) {
      setGiftRowsByField((rows) => ({
        ...rows,
        [fieldId]: rows[fieldId]?.length ? rows[fieldId] : [newGiftRow(fieldId)],
      }));
    }

    setSelectedDeliveryFields(next);
  }

  const deliveryHydrationKey = `${order._id}|${savedGiftCardsKey}|${deliveredCodesKey}|${deliveryOptionsKey}|${JSON.stringify(productAttributesByProductId)}`;

  useEffect(() => {
    const hydrated = hydrateManualGiftDeliveryFromOrder(
      order.manualGiftCards,
      baseDeliveryFieldOptions,
      order.items,
      productAttributesByProductId,
    );
    if (hydrated.selectedDeliveryFields.length > 0) {
      setSelectedDeliveryFields(hydrated.selectedDeliveryFields);
      setGiftRowsByField(hydrated.giftRowsByField);
      return;
    }
    if (
      hasManualItems &&
      baseDeliveryFieldOptions.length === 1 &&
      baseDeliveryFieldOptions[0] &&
      order.status !== "delivered"
    ) {
      const onlyId = baseDeliveryFieldOptions[0].id;
      setSelectedDeliveryFields([onlyId]);
      setGiftRowsByField({ [onlyId]: [newGiftRow(onlyId)] });
      return;
    }
    setSelectedDeliveryFields([]);
    setGiftRowsByField({});
  }, [
    baseDeliveryFieldOptions,
    deliveryHydrationKey,
    hasManualItems,
    order.items,
    order.manualGiftCards,
    order.status,
    productAttributesByProductId,
  ]);

  function updateGiftRow(
    fieldId: string,
    rowId: string,
    patch: Partial<AdminOrderGiftCardRow>,
  ) {
    setGiftRowsByField((rows) => ({
      ...rows,
      [fieldId]: (rows[fieldId] ?? []).map((row) =>
        row.id === rowId ? { ...row, ...patch } : row,
      ),
    }));
  }

  function addGiftRow(fieldId: string) {
    setGiftRowsByField((rows) => ({
      ...rows,
      [fieldId]: [...(rows[fieldId] ?? []), newGiftRow(fieldId)],
    }));
  }

  function resolveStockPickAmount(pickAmount?: string): string {
    const trimmed = pickAmount?.trim() ?? "";
    if (trimmed) return trimmed;

    const fieldId = selectedDeliveryFields[0];
    const fieldLabel = fieldId
      ? resolveDeliveryFieldBoxTitle(fieldId, deliveryFieldOptions)
      : undefined;
    const productName = fieldLabel
      ? parseDeliveryFieldOptionProductName(fieldLabel)
      : null;

    const candidates = productName
      ? order.items.filter((item) => {
          const { productTitle } = parseOrderItemPackage(item.title);
          return productTitle.toLowerCase() === productName.toLowerCase();
        })
      : order.items;

    for (const item of candidates) {
      const amount = resolveGiftCardAmountForOrderItem(
        item,
        productAttributesByProductId,
      );
      if (amount) return amount;
    }

    return "";
  }

  function addGiftRowFromStock(pick: {
    code: string;
    amount?: string;
    inventoryItemId: string;
  }) {
    const fieldId = selectedDeliveryFields[0];
    if (!fieldId) return;
    const resolvedAmount = resolveStockPickAmount(pick.amount);

    setGiftRowsByField((rows) => {
      const fieldRows = rows[fieldId] ?? [];
      const emptyIndex = fieldRows.findIndex((row) => !row.code.trim());
      if (emptyIndex >= 0) {
        const emptyRow = fieldRows[emptyIndex];
        if (!emptyRow) return rows;
        const next = [...fieldRows];
        next[emptyIndex] = {
          ...emptyRow,
          code: pick.code,
          amount: resolvedAmount || emptyRow.amount,
          inventoryItemId: pick.inventoryItemId,
        };
        return { ...rows, [fieldId]: next };
      }

      return {
        ...rows,
        [fieldId]: [
          ...fieldRows,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            code: pick.code,
            amount: resolvedAmount,
            deliveryFieldId: fieldId,
            inventoryItemId: pick.inventoryItemId,
          },
        ],
      };
    });
  }

  function removeGiftRow(fieldId: string, rowId: string) {
    const fieldRows = giftRowsByField[fieldId] ?? [];
    if (fieldRows.length > 1) {
      setGiftRowsByField((rows) => ({
        ...rows,
        [fieldId]: fieldRows.filter((row) => row.id !== rowId),
      }));
      return;
    }

    setSelectedDeliveryFields((selected) =>
      selected.filter((id) => id !== fieldId),
    );
    setGiftRowsByField((rows) => {
      const copy = { ...rows };
      delete copy[fieldId];
      return copy;
    });
  }

  function buildCompletePayload(): AdminOrderCompletePayload {
    const giftCards = allGiftRows
      .filter((row) => row.code.trim())
      .map((row) => ({
        code: row.code.trim(),
        amount: row.amount.trim() || undefined,
        fieldLabel: row.deliveryFieldId
          ? resolveDeliveryFieldBoxTitle(
              row.deliveryFieldId,
              deliveryFieldOptions,
            )
          : undefined,
        inventoryItemId: row.inventoryItemId,
      }));

    const autoTemplateMessage = buildAutoMessageOneFromSelection(
      selectedDeliveryFields,
      deliveryFields,
    );
    const noteParts = [customerNote.trim(), autoTemplateMessage].filter(Boolean);

    return {
      deliveryMessage: noteParts.join("\n\n") || undefined,
      emailChannel: noteSenderChannel,
      giftCards,
    };
  }

  function handleUpdateStatus() {
    if (statusDraft === "delivered") {
      onCompleteOrder(buildCompletePayload());
      return;
    }
    onUpdateStatus();
  }

  useEffect(() => {
    setCustomerNote(order.deliveryMessage ?? "");
    setSelectedSavedNoteId("");
    setDeliveryMessageDismissed(false);
  }, [order._id, order.deliveryMessage]);

  async function copyCustomerInput(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCustomerInputKey(key);
      window.setTimeout(() => setCopiedCustomerInputKey(null), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="admin-order-view">
      <div className="admin-order-detail-layout">
        <div className="admin-order-detail-main space-y-5">
          <CollapsibleCard
            className="admin-order-view-sidebar-card admin-order-view-sidebar-card--items admin-order-view-sidebar-card--pro"
            headerClassName="admin-order-view-pro-section-head"
            title="Order items"
            subtitle={`${order.items.length} ${order.items.length === 1 ? "product" : "products"} in this order`}
            icon={<BoxIcon className="h-4 w-4" />}
          >
            <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <div className="admin-order-view-items-layout">
                <div className="admin-order-view-items-list">
                  {order.items.map((it, i) => {
                    const { productTitle, packageName } =
                      parseOrderItemPackage(it.title);
                    const thumb = productThumbs[it.productId];
                    const lineKey = `${it.productId}::${it.variationValueId ?? ""}`;
                    const itemRegions = productRegionsByLineKey[lineKey] ?? [];
                    const regionLabel =
                      itemRegions.length > 0
                        ? itemRegions.join(", ")
                        : orderRegions.length > 0
                          ? orderRegions.join(", ")
                          : "—";

                    return (
                      <article
                        key={i}
                        className="admin-order-view-item-block"
                      >
                        <div className="admin-order-view-item-top">
                          <div className="admin-order-view-item-cell">
                            <span className="admin-order-view-thumb">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" />
                              ) : (
                                <BoxIcon className="h-5 w-5 text-brand" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="admin-order-view-item-title">
                                {productTitle}
                              </p>
                              <ul className="admin-order-view-item-meta">
                                <li>
                                  Region <span>{regionLabel}</span>
                                </li>
                                {packageName ? (
                                  <li>
                                    Gift Card Amount{" "}
                                    <span>{packageName}</span>
                                  </li>
                                ) : null}
                                <li>
                                  Quantity{" "}
                                  <span>{orderLineQuantity(it.quantity)}</span>
                                </li>
                                <li className="capitalize">
                                  {it.deliveryType} delivery
                                </li>
                              </ul>
                            </div>
                          </div>

                          <div className="admin-order-view-item-prices">
                            <span><PriceText amount={it.unitPrice} currency={currency} /></span>
                            <span>× {orderLineQuantity(it.quantity)}</span>
                            <span className="admin-order-view-item-line-total">
                              <PriceText amount={it.lineTotal} currency={currency} />
                            </span>
                          </div>
                        </div>

                        {(it.customerInputs ?? []).length > 0 ? (
                          <div className="admin-order-view-item-customer-inputs">
                            {(it.customerInputs ?? []).map((input, inputIndex) => (
                              <OrderItemCustomerInputField
                                key={`${input.label}-${inputIndex}`}
                                label={input.label}
                                value={input.value}
                                fieldKey={`${i}-${inputIndex}`}
                                copiedKey={copiedCustomerInputKey}
                                onCopy={copyCustomerInput}
                              />
                            ))}
                          </div>
                        ) : null}

                        {orderNote && i === 0 ? (
                          <p className="admin-order-view-item-note">
                            {orderNote}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                <div className="admin-order-view-items-totals-col">
                  <p>
                    Items Subtotal:{" "}
                    <span><PriceText amount={order.pricing.subtotal} currency={currency} /></span>
                  </p>
                  {order.pricing.discountTotal > 0 ? (
                    <p className="text-emerald-400">
                      Discount:{" "}
                      <span>
                        −<PriceText amount={order.pricing.discountTotal} currency={currency} />
                      </span>
                    </p>
                  ) : null}
                  <p className="admin-order-view-items-total-line">
                    Order Total:{" "}
                    <span><PriceText amount={order.pricing.total} currency={currency} /></span>
                  </p>
                  <p className="admin-order-view-items-total-line">
                    Paid:{" "}
                    <span><PriceText amount={order.pricing.total} currency={currency} /></span>
                  </p>
                  <p className="admin-order-view-paid-note">
                    {formatAdminPaymentWhen(
                      order.payment.paidAt,
                      order.payment.method,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleCard>

          <OrderItemsCustomerSection
            customerName={customerName}
            customer={customer}
            contact={contact}
          />

          <OrderItemsPaymentSection
            order={order}
            gatewayLabel={gatewayLabel}
            className="hidden xl:block"
          />

          {showManualDelivery ? (
            <CollapsibleCard
              className="admin-order-view-sidebar-card admin-order-view-sidebar-card--delivery admin-order-view-sidebar-card--pro"
              headerClassName="admin-order-view-pro-section-head"
              title="Manual Gift Card Delivery"
              icon={<TruckIcon className="h-4 w-4" />}
            >
              <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dl className="admin-order-view-detail-list admin-order-view-detail-list--in-panel">
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Delivery field</dt>
                  <p className="admin-order-view-detail-help">
                    Select one or more items to deliver together.
                  </p>
                  {deliveryFieldOptions.length > 0 ? (
                    <dd>
                      <AdminMultiSelect
                        values={selectedDeliveryFields}
                        onChange={updateGiftRowsForSelection}
                        placeholder="Select delivery field…"
                        className="admin-order-view-delivery-select w-full"
                        disabled={busy}
                        hideCheckboxes
                        closeOnSelect
                        options={deliveryFieldOptions.map((opt) => ({
                          value: opt.id,
                          label: opt.label,
                        }))}
                      />
                    </dd>
                  ) : (
                    <p className="admin-order-view-detail-help">
                      No delivery fields yet. Add templates under{" "}
                      <Link href="/admin/settings/delivery">
                        Settings → Manual Delivery
                      </Link>
                      , click <strong>Save templates</strong>, then reopen this
                      order.
                    </p>
                  )}
                </div>

                {selectedDeliveryFields.length > 0 ? (
                  <>
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dd>
                        <ManualDeliveryStockPicker
                          orderItems={order.items}
                          usedInventoryIds={usedInventoryIds}
                          targetFieldId={stockTargetFieldId}
                          disabled={busy}
                          onPick={addGiftRowFromStock}
                        />
                      </dd>
                    </div>

                    {selectedOptions.map((opt) => {
                      const fieldRows = giftRowsByField[opt.id] ?? [];
                      if (fieldRows.length === 0) return null;
                      return (
                        <div
                          key={opt.id}
                          className="admin-order-view-detail-row admin-order-view-detail-row--stacked"
                        >
                          <dt>{opt.label}</dt>

                          {opt.message ? (
                            <dd className="admin-order-view-detail-help">
                              {opt.message}
                            </dd>
                          ) : null}

                          <div className="admin-order-view-gift-list">
                            {fieldRows.map((row) => (
                              <div
                                key={row.id}
                                className="admin-order-view-gift-row"
                              >
                                <input
                                  type="text"
                                  value={row.code}
                                  onChange={(e) =>
                                    updateGiftRow(opt.id, row.id, {
                                      code: e.target.value,
                                      inventoryItemId: undefined,
                                    })
                                  }
                                  placeholder="Gift card"
                                  aria-label="Gift card code"
                                  className="admin-order-view-input"
                                />
                                <input
                                  type="text"
                                  value={resolveGiftCardAmountDisplay(row.amount)}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(
                                      /[^\d.]/g,
                                      "",
                                    );
                                    updateGiftRow(opt.id, row.id, {
                                      amount: digits ? `${digits}$` : "",
                                    });
                                  }}
                                  placeholder="2$"
                                  aria-label="Gift card amount"
                                  className="admin-order-view-input admin-order-view-input--sm"
                                />
                                {row.inventoryItemId ? (
                                  <span
                                    className="shrink-0 self-center rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-brand"
                                    title="Linked to inventory stock"
                                  >
                                    Stock
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => addGiftRow(opt.id)}
                                  className="admin-order-view-icon-btn"
                                  aria-label="Add gift card row"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeGiftRow(opt.id, row.id)}
                                  className="admin-order-view-icon-btn admin-order-view-icon-btn--danger"
                                  aria-label="Remove gift card row"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <div className="admin-order-view-manual-actions">
                        <div className="flex flex-col items-start gap-0.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onSaveManualDelivery(buildCompletePayload())}
                            className="dashboard-pro-btn-ghost inline-flex items-center gap-2"
                          >
                            <ReceiptIcon className="h-4 w-4" aria-hidden />
                            Save delivery
                          </button>
                          <span className="text-[10px] text-subtle pl-1">
                            Saves codes only — no email sent
                          </span>
                        </div>
                        <div className="flex flex-col items-start gap-0.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onCompleteOrder(buildCompletePayload())}
                            className="btn-primary btn-primary-sm inline-flex items-center gap-2"
                          >
                            <MailIcon className="h-4 w-4" aria-hidden />
                            Send Gift Card
                          </button>
                          <span className="text-[10px] text-subtle pl-1">
                            Marks Order Send Customer Email
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </dl>
              </div>
            </CollapsibleCard>
          ) : null}

          <CollapsibleCard
            className="admin-order-view-sidebar-card admin-order-view-sidebar-card--customer-note admin-order-view-sidebar-card--pro"
            headerClassName="admin-order-view-pro-section-head"
            title="Customer note"
            icon={<MailIcon className="h-4 w-4" />}
          >
            <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
            <dl className="admin-order-view-detail-list admin-order-view-detail-list--in-panel">
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                {savedNoteOptions.length > 0 ? (
                  <AdminSelect
                    id="order-customer-saved-note"
                    value={selectedSavedNoteId}
                    onChange={(value) => {
                      setSelectedSavedNoteId(value);
                      const picked = savedNoteOptions.find(
                        (item) => item.id === value,
                      );
                      if (picked) setCustomerNote(picked.note);
                    }}
                    options={[
                      { value: "", label: "Select a saved note…" },
                      ...savedNoteOptions.map((item, index) => ({
                        value: item.id,
                        label: `${index + 1}. ${item.label}`,
                      })),
                    ]}
                    className="w-full"
                    disabled={busy}
                  />
                ) : null}

                <div>
                  <label
                    className="admin-filter-label"
                    htmlFor="order-customer-note-sender"
                  >
                    Sender type
                  </label>
                  <AdminSelect
                    id="order-customer-note-sender"
                    value={noteSenderChannel}
                    onChange={(value) =>
                      setNoteSenderChannel(value as EmailSenderChannel)
                    }
                    options={EMAIL_SENDER_CHANNEL_OPTIONS}
                    className="w-full"
                    disabled={busy}
                  />
                </div>

                <div>
                  <label
                    className="admin-filter-label"
                    htmlFor="order-customer-note-body"
                  >
                    Message
                  </label>
                  <textarea
                    id="order-customer-note-body"
                    value={customerNote}
                    onChange={(e) => {
                      setCustomerNote(e.target.value);
                      setSelectedSavedNoteId("");
                    }}
                    rows={5}
                    placeholder="Select a saved note above or write your own message…"
                    className="admin-order-view-input min-h-[7rem] resize-y"
                    disabled={busy}
                  />
                </div>

                <button
                  type="button"
                  disabled={busy || !customerNote.trim() || !customerEmail}
                  onClick={() =>
                    onSendNote(customerNote.trim(), noteSenderChannel)
                  }
                  className="btn-primary btn-primary-sm admin-order-view-customer-note-btn inline-flex items-center gap-2"
                >
                  <MailIcon className="h-4 w-4" aria-hidden />
                  Send note to customer
                </button>
              </div>
            </dl>
            </div>
          </CollapsibleCard>

          <OrderItemsPaymentSection
            order={order}
            gatewayLabel={gatewayLabel}
            className="xl:hidden"
          />

          <CustomerHistoryCard
            customerHistory={customerHistory}
            currency={currency}
            className="xl:hidden"
          />

          <OrderOriginCard order={order} className="xl:hidden" />

          {order.deliveryMessage && !deliveryMessageDismissed ? (
            <div
              className="admin-order-delivery-msg-modal fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-order-delivery-msg-title"
            >
              <button
                type="button"
                className="admin-order-delivery-msg-modal-backdrop"
                aria-label="Close delivery message notice"
                onClick={() => setDeliveryMessageDismissed(true)}
              />
              <section className="admin-order-delivery-msg admin-order-delivery-msg--popup">
                <div className="admin-order-delivery-msg-top">
                  <div className="admin-order-delivery-msg-identity">
                    <span className="admin-order-delivery-msg-icon" aria-hidden>
                      <CheckIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3
                        id="admin-order-delivery-msg-title"
                        className="admin-order-delivery-msg-title"
                      >
                        Delivery message sent
                      </h3>
                      <p className="admin-order-delivery-msg-sub">
                        This message was delivered to the customer.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-order-delivery-msg-close"
                    aria-label="Close"
                    onClick={() => setDeliveryMessageDismissed(true)}
                  >
                    <CloseIcon className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {deliveryMessageProducts.length > 0 ? (
                  <div className="admin-order-delivery-msg-products">
                    {deliveryMessageProducts.map((product) => (
                      <div
                        key={product.productId}
                        className="admin-order-delivery-msg-product"
                      >
                        <span className="admin-order-view-thumb admin-order-delivery-msg-product-thumb">
                          {product.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.thumbUrl} alt="" />
                          ) : (
                            <BoxIcon className="h-5 w-5 text-brand" />
                          )}
                        </span>
                        <p className="admin-order-delivery-msg-product-title">
                          {product.productTitle}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="admin-order-delivery-msg-body">
                  <p className="admin-order-delivery-msg-body-label">Message</p>
                  <div className="admin-order-delivery-msg-content">
                    {order.deliveryMessage}
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <aside className="admin-order-detail-sidebar space-y-5">
          <CollapsibleCard
            className="admin-order-view-sidebar-card admin-order-view-sidebar-card--status admin-order-view-sidebar-card--pro"
            headerClassName="admin-order-view-pro-section-head"
            title="Order status"
            icon={<CheckIcon className="h-4 w-4" />}
          >
            <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dl className="admin-order-view-detail-list admin-order-view-detail-list--in-panel">
                <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
                  <dt>Status</dt>
                  <dd>
                    <span
                      className={
                        ADMIN_ORDER_DETAIL_STATUS_STYLE[order.status] ??
                        "dashboard-pro-status dashboard-pro-status--brand"
                      }
                    >
                      {ADMIN_ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </dd>
                </div>

                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <div className="admin-order-view-status-change-row">
                    <span className="admin-order-view-toolbar-label">Change</span>
                    <AdminSelect
                      value={statusDraft}
                      onChange={(v) => onStatusDraftChange(v as OrderStatusValue)}
                      options={ADMIN_ORDER_STATUS_OPTIONS.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                      className="admin-order-view-status-select min-w-0 flex-1"
                      disabled={busy}
                    />
                  </div>
                  <div className="admin-order-view-status-actions">
                    <button
                      type="button"
                      disabled={busy || statusDraft === order.status}
                      onClick={handleUpdateStatus}
                      className="btn-primary btn-primary-sm admin-order-view-update-btn inline-flex items-center gap-2"
                      title={statusDraft === order.status ? "Status is already set to this value" : undefined}
                    >
                      <CheckIcon className="h-4 w-4" aria-hidden />
                      Update status
                    </button>
                    {order.status === "failed" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onTrash}
                        className="admin-order-view-trash-btn"
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden />
                        Delete permanently
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onMoveToTrash}
                        className="admin-order-view-trash-btn"
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden />
                        Move to trash
                      </button>
                    )}
                  </div>
                </div>
              </dl>
            </div>
          </CollapsibleCard>

          <CustomerHistoryCard
            customerHistory={customerHistory}
            currency={currency}
            className="hidden xl:block"
          />

          <OrderOriginCard order={order} className="hidden xl:block" />
        </aside>
      </div>
    </div>
  );
}
