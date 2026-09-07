import type { CustomOrderField } from "@/components/admin/custom-order-fields-editor";
import { normalizeRegionCode } from "@/components/admin/custom-order-fields-editor";
import {
  inventoryManagedPackages,
  resolveGiftCardAmountDisplay,
} from "@/lib/inventory-packages";
import type { AdminCustomerRow, CustomerRole, OrderDetail, OrderLine, UserProfile } from "@/lib/api";
import { CUSTOMER_ROLE_LABELS } from "@/lib/api";

export type DeliveryFieldOption = {
  id: string;
  label: string;
  message?: string;
};

function previewDeliveryMessage(text: string, max = 72): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

/** Template applies when it has no regions or overlaps order product regions. */
export function customOrderFieldMatchesRegions(
  field: CustomOrderField,
  orderRegions?: string[],
): boolean {
  const fieldRegions = field.regions.map(normalizeRegionCode).filter(Boolean);
  if (fieldRegions.length === 0) return true;

  const normalizedOrderRegions = (orderRegions ?? [])
    .map(normalizeRegionCode)
    .filter(Boolean);
  if (normalizedOrderRegions.length === 0) return true;

  return fieldRegions.some((region) => normalizedOrderRegions.includes(region));
}

export function collectOrderProductRegions(
  regionsByProductId: Record<string, string[]>,
  productIds: string[],
): string[] {
  const seen = new Set<string>();
  const regions: string[] = [];
  for (const productId of productIds) {
    for (const region of regionsByProductId[productId] ?? []) {
      const code = normalizeRegionCode(region);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      regions.push(code);
    }
  }
  return regions;
}

function resolveTemplateFieldId(optionId: string): string | null {
  if (optionId.startsWith("msg-")) {
    const rest = optionId.slice(4);
    const indexSep = rest.lastIndexOf("-");
    if (indexSep <= 0) return null;
    return rest.slice(0, indexSep);
  }
  if (optionId.startsWith("label-")) {
    return optionId.slice(6);
  }
  return null;
}

/** First pre-written message (Message 1) for each selected delivery template. */
export function buildAutoMessageOneFromSelection(
  selectedOptionIds: string[],
  fields: CustomOrderField[],
): string {
  const templateIds = [
    ...new Set(
      selectedOptionIds
        .map(resolveTemplateFieldId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const parts: string[] = [];
  for (const templateId of templateIds) {
    const field = fields.find((item) => item.id === templateId);
    if (!field) continue;
    const messageOne = field.messages.map((message) => message.trim()).find(Boolean);
    if (messageOne) parts.push(messageOne);
  }

  return parts.join("\n\n");
}

export const MANUAL_GENERAL_DELIVERY_ID = "manual-general";

export function buildDeliveryFieldOptions(
  fields: CustomOrderField[],
  orderRegions?: string[],
  opts?: { includeAllRegions?: boolean },
): DeliveryFieldOption[] {
  const options: DeliveryFieldOption[] = [];
  let n = 1;

  for (const field of fields) {
    if (!field.enabled) continue;
    if (
      !opts?.includeAllRegions &&
      !customOrderFieldMatchesRegions(field, orderRegions)
    ) {
      continue;
    }

    const fieldLabel = field.label.trim();
    if (!fieldLabel) continue;

    const messages = field.messages.map((message) => message.trim()).filter(Boolean);
    if (messages.length === 0) {
      options.push({
        id: `label-${field.id}`,
        label: `${n}. Template · ${fieldLabel}`,
        message: fieldLabel,
      });
      n += 1;
      continue;
    }

    for (const [index, message] of messages.entries()) {
      options.push({
        id: `msg-${field.id}-${index}`,
        label: `${n}. ${fieldLabel} · ${previewDeliveryMessage(message)}`,
        message,
      });
      n += 1;
    }
  }

  return options;
}

/** Admin order view: all enabled templates, or a generic row for manual items. */
export function buildAdminDeliveryFieldOptions(
  fields: CustomOrderField[],
  orderRegions: string[],
  hasManualItems: boolean,
): DeliveryFieldOption[] {
  const fromTemplates = buildDeliveryFieldOptions(fields, orderRegions, {
    includeAllRegions: true,
  });
  if (fromTemplates.length > 0) return fromTemplates;
  if (!hasManualItems) return [];
  return [
    {
      id: MANUAL_GENERAL_DELIVERY_ID,
      label: "Gift card",
      message: "",
    },
  ];
}

export function resolveDeliveryFieldBoxTitle(
  optionId: string,
  options: DeliveryFieldOption[],
): string | undefined {
  const label = options.find((item) => item.id === optionId)?.label.trim();
  return label || undefined;
}

const DELIVERY_FIELD_LABEL_PREFIX =
  /^\d+\.\s*(?:Template\s·\s*)?[^·]+·\s*/;

/** Strip admin dropdown prefix e.g. "3. UniPin Uc Voucher · " for customer display. */
export function stripDeliveryFieldLabelPrefix(label: string): string {
  return label.replace(DELIVERY_FIELD_LABEL_PREFIX, "").trim();
}

/** Product name from a delivery-field dropdown label e.g. "1. iTunes Gift Card · Redeem Code". */
export function parseDeliveryFieldOptionProductName(label: string): string | null {
  const trimmed = label.trim();
  const withoutNum = trimmed.replace(/^\d+\.\s*/, "");
  if (!withoutNum) return null;

  const dotIdx = withoutNum.indexOf(" · ");
  const head = dotIdx >= 0 ? withoutNum.slice(0, dotIdx) : withoutNum;
  const templatePrefix = "Template · ";
  if (head.startsWith(templatePrefix)) {
    return head.slice(templatePrefix.length).trim() || null;
  }
  return head.trim() || null;
}

export type DeliveryMessageProduct = {
  productId: string;
  productTitle: string;
  thumbUrl?: string;
};

/** Order line items tied to manual gift-card delivery fields (for delivery message UI). */
export function resolveDeliveryMessageProducts(
  order: Pick<OrderDetail, "items" | "manualGiftCards">,
  productThumbs: Record<string, string>,
): DeliveryMessageProduct[] {
  const candidateNames: string[] = [];

  for (const card of order.manualGiftCards ?? []) {
    const label = card.fieldLabel?.trim();
    if (!label) continue;
    const productName = parseDeliveryFieldOptionProductName(label);
    if (productName) candidateNames.push(productName);
  }

  const seenNames = new Set<string>();
  const uniqueNames: string[] = [];
  for (const name of candidateNames) {
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    uniqueNames.push(name);
  }

  const results: DeliveryMessageProduct[] = [];
  const usedProductIds = new Set<string>();

  const addItem = (item: OrderDetail["items"][number]) => {
    if (usedProductIds.has(item.productId)) return;
    usedProductIds.add(item.productId);
    results.push({
      productId: item.productId,
      productTitle: parseOrderItemPackage(item.title).productTitle,
      thumbUrl: productThumbs[item.productId],
    });
  };

  for (const name of uniqueNames) {
    const needle = name.toLowerCase();
    const item = order.items.find((it) => {
      const title = parseOrderItemPackage(it.title).productTitle.toLowerCase();
      return title === needle || title.includes(needle) || needle.includes(title);
    });
    if (item) addItem(item);
  }

  if (results.length === 0) {
    for (const item of order.items) {
      if (item.deliveryType !== "manual") continue;
      addItem(item);
    }
  }

  const fallbackItem = order.items[0];
  if (results.length === 0 && fallbackItem) {
    addItem(fallbackItem);
  }

  return results;
}

export function resolveOrderDetailsFieldTitle(
  giftCards?: Array<{ fieldLabel?: string }>,
): string | null {
  if (!giftCards?.length) return null;
  const labels = [
    ...new Set(
      giftCards
        .map((card) => card.fieldLabel?.trim())
        .filter((label): label is string => Boolean(label))
        .map(stripDeliveryFieldLabelPrefix)
        .filter(Boolean),
    ),
  ];
  return labels.length > 0 ? labels.join(" · ") : null;
}

export type AdminCustomerOrderHistory = {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
};

export type AdminOrderGiftCardRow = {
  id: string;
  code: string;
  amount: string;
  deliveryFieldId?: string;
  inventoryItemId?: string;
};

import type { EmailSenderChannel } from "@/lib/api";

export type AdminOrderCompletePayload = {
  deliveryMessage?: string;
  emailChannel?: EmailSenderChannel;
  giftCards: Array<{
    code: string;
    amount?: string;
    fieldLabel?: string;
    inventoryItemId?: string;
  }>;
};

export function resolveSelectedDeliveryOptions(
  selectedFieldIds: string[],
  options: DeliveryFieldOption[],
): DeliveryFieldOption[] {
  return selectedFieldIds
    .map((fieldId) => {
      const matched = options.find((opt) => opt.id === fieldId);
      if (matched) return matched;
      if (fieldId.startsWith("saved:")) {
        return {
          id: fieldId,
          label: fieldId.slice("saved:".length),
        };
      }
      return null;
    })
    .filter((opt): opt is DeliveryFieldOption => opt != null);
}

function normalizeHydratedInventoryItemId(
  id: string | { toString(): string } | undefined,
): string | undefined {
  if (!id) return undefined;
  if (typeof id === "string") {
    const trimmed = id.trim();
    return trimmed || undefined;
  }
  const asString = String(id);
  return asString && asString !== "[object Object]" ? asString : undefined;
}

function matchDeliveryFieldOptionId(
  fieldLabel: string,
  options: DeliveryFieldOption[],
): string | null {
  const trimmed = fieldLabel.trim();
  if (!trimmed) return null;

  const exact = options.find((opt) => opt.label.trim() === trimmed);
  if (exact) return exact.id;

  const strippedInput = trimmed.replace(/^\d+\.\s*/, "");
  const byStripped = options.find(
    (opt) => opt.label.trim().replace(/^\d+\.\s*/, "") === strippedInput,
  );
  if (byStripped) return byStripped.id;

  const productFromInput = parseDeliveryFieldOptionProductName(trimmed);
  if (productFromInput) {
    const byProduct = options.find((opt) => {
      const product = parseDeliveryFieldOptionProductName(opt.label);
      return product?.toLowerCase() === productFromInput.toLowerCase();
    });
    if (byProduct) return byProduct.id;
  }

  return null;
}

function resolveHydratedDeliveryFieldId(
  fieldLabel: string | undefined,
  options: DeliveryFieldOption[],
): string {
  const label = fieldLabel?.trim();
  if (!label) return "saved:unassigned";

  const matched = matchDeliveryFieldOptionId(label, options);
  if (matched) return matched;

  return `saved:${label}`;
}

function resolveHydratedFieldIdForProductTitle(
  productTitle: string,
  options: DeliveryFieldOption[],
): string {
  const trimmed = productTitle.trim();
  if (!trimmed) return "saved:unassigned";

  const byProduct = options.find((opt) => {
    const product = parseDeliveryFieldOptionProductName(opt.label);
    return product?.toLowerCase() === trimmed.toLowerCase();
  });
  if (byProduct) return byProduct.id;

  const byLabelContains = options.find((opt) =>
    opt.label.toLowerCase().includes(trimmed.toLowerCase()),
  );
  if (byLabelContains) return byLabelContains.id;

  return `saved:${trimmed}`;
}

export function hydrateManualGiftDeliveryFromOrder(
  manualGiftCards:
    | Array<{
        code: string;
        amount?: string;
        fieldLabel?: string;
        inventoryItemId?: string | { toString(): string };
      }>
    | undefined,
  options: DeliveryFieldOption[],
  orderItems?: Array<
    Pick<OrderLine, "title" | "deliveredCodes" | "variationValueId" | "productId">
  >,
  productAttributesByProductId?: Record<
    string,
    Record<string, unknown> | undefined
  >,
): {
  selectedDeliveryFields: string[];
  giftRowsByField: Record<string, AdminOrderGiftCardRow[]>;
} {
  const giftRowsByField: Record<string, AdminOrderGiftCardRow[]> = {};
  const selectedDeliveryFields: string[] = [];
  let rowCounter = 0;

  const pushRow = (
    fieldId: string,
    row: {
      code: string;
      amount?: string;
      inventoryItemId?: string | { toString(): string };
    },
  ) => {
    const code = row.code.trim();
    if (!code) return;

    if (!selectedDeliveryFields.includes(fieldId)) {
      selectedDeliveryFields.push(fieldId);
    }

    const giftRows = giftRowsByField[fieldId] ?? [];
    giftRowsByField[fieldId] = giftRows;

    const duplicateIndex = giftRows.findIndex(
      (existing) => existing.code.trim() === code,
    );
    if (duplicateIndex >= 0) {
      const existing = giftRows[duplicateIndex];
      if (!existing) return;
      const nextAmount = row.amount?.trim() ?? "";
      if (!existing.amount.trim() && nextAmount) {
        giftRows[duplicateIndex] = {
          ...existing,
          amount: nextAmount,
        };
      }
      return;
    }

    giftRows.push({
      id: `hydrated-${rowCounter++}`,
      code,
      amount: row.amount?.trim() ?? "",
      deliveryFieldId: fieldId,
      inventoryItemId: normalizeHydratedInventoryItemId(row.inventoryItemId),
    });
  };

  for (const card of manualGiftCards ?? []) {
    const fieldId = resolveHydratedDeliveryFieldId(card.fieldLabel, options);
    let amount = card.amount?.trim() ?? "";
    if (!amount && orderItems?.length) {
      const productName = card.fieldLabel
        ? parseDeliveryFieldOptionProductName(card.fieldLabel)
        : null;
      const matchedItem = productName
        ? orderItems.find((item) => {
            const { productTitle } = parseOrderItemPackage(item.title);
            return productTitle.toLowerCase() === productName.toLowerCase();
          })
        : undefined;
      if (matchedItem) {
        amount = resolveGiftCardAmountForOrderItem(
          matchedItem,
          productAttributesByProductId,
        );
      }
    }
    if (!amount) {
      amount = resolveGiftCardAmountDisplay(card.amount ?? "");
    }
    pushRow(fieldId, { ...card, amount });
  }

  for (const item of orderItems ?? []) {
    if (!item.deliveredCodes?.length) continue;
    const { productTitle } = parseOrderItemPackage(item.title);
    const fieldId = resolveHydratedFieldIdForProductTitle(productTitle, options);
    const defaultAmount = resolveGiftCardAmountForOrderItem(
      item,
      productAttributesByProductId,
    );
    for (const delivered of item.deliveredCodes) {
      pushRow(fieldId, {
        ...delivered,
        amount: defaultAmount,
      });
    }
  }

  return { selectedDeliveryFields, giftRowsByField };
}

export function mapCustomerOrderStats(
  stats: { totalOrders: number; totalSpent: number },
): AdminCustomerOrderHistory {
  const { totalOrders, totalSpent } = stats;
  return {
    totalOrders,
    totalRevenue: totalSpent,
    averageOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
  };
}

export function isGuestMailbox(email: string | undefined | null): boolean {
  const n = (email ?? "").trim().toLowerCase();
  if (!n) return false;
  // Covers active guest sessions (@guest.local), finalized/anonymised guests
  // (@removed.local), soft-deleted registered accounts (deleted+…@removed.local),
  // and legacy guest_ prefix.
  return (
    n.endsWith("@guest.local") ||
    n.endsWith("@removed.local") ||
    n.startsWith("guest+") ||
    n.startsWith("deleted+") ||
    n.startsWith("guest_")
  );
}

function nameFromEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return "";
  const at = trimmed.indexOf("@");
  return at > 0 ? trimmed.slice(0, at) : trimmed;
}

export function getCustomerDisplayName(
  customer: {
    email: string;
    profile?: AdminCustomerRow["profile"];
  },
  contact?: { fullName?: string; email?: string } | null,
): string {
  const profile = customer.profile;
  const fromProfile =
    profile?.displayName?.trim() ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  if (fromProfile) return fromProfile;

  const fromContactName = contact?.fullName?.trim();
  if (fromContactName) return fromContactName;

  const contactEmail = contact?.email?.trim();
  if (contactEmail && !isGuestMailbox(contactEmail)) {
    return nameFromEmail(contactEmail) || contactEmail;
  }

  if (!isGuestMailbox(customer.email)) {
    return nameFromEmail(customer.email) || customer.email;
  }

  return "Guest";
}

/** First name for order edit-lock badges (orders list + detail). */
export function getAdminLockDisplayName(user: UserProfile): string {
  const first = user.profile?.firstName?.trim();
  if (first) return first;

  const display = user.profile?.displayName?.trim();
  if (display) {
    const word = display.split(/\s+/)[0]?.trim();
    if (word) return word;
  }

  if (!isGuestMailbox(user.email)) {
    return nameFromEmail(user.email) || user.email;
  }

  return "Staff";
}

/** Prefer checkout contact name over guest mailbox placeholders in order lists. */
export function resolveOrderCustomerLabel(
  order: Pick<OrderDetail, "contact">,
  fetchedName?: string,
): string {
  const fromContact = order.contact?.fullName?.trim();
  if (fromContact) return fromContact;

  const contactEmail = order.contact?.email?.trim();
  if (contactEmail && !isGuestMailbox(contactEmail)) {
    return nameFromEmail(contactEmail) || contactEmail;
  }

  if (fetchedName && !isGuestMailbox(fetchedName)) {
    return fetchedName;
  }

  // fromContact is always falsy at this point (returned early at top if truthy)
  return "Guest";
}

const ROLE_SUBTITLE_PRIORITY = [
  "administrator",
  "admin",
  "editor",
  "support",
  "shop_manager",
  "blogger",
  "author",
  "contributor",
  "supplier",
  "reseller",
  "affiliate",
  "vip",
  "subscriber",
  "customer",
] as const;

const LEGACY_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  support: "Support",
};

function roleLabel(role: string): string {
  return (
    CUSTOMER_ROLE_LABELS[role as CustomerRole] ??
    LEGACY_ROLE_LABELS[role] ??
    role
  );
}

/** Primary role label for account subtitles (e.g. name → Admin). */
export function getPrimaryRoleLabel(roles?: string[] | null): string | null {
  if (!roles?.length) return null;
  for (const role of ROLE_SUBTITLE_PRIORITY) {
    if (roles.includes(role)) {
      return roleLabel(role);
    }
  }
  const fallback = roles[0];
  return fallback ? roleLabel(fallback) : null;
}

export function parseOrderItemPackage(title: string): {
  productTitle: string;
  packageName?: string;
} {
  const match = title.match(/^(.+?)\s+\((.+)\)$/);
  if (!match) {
    return { productTitle: title };
  }
  const productTitle = match[1];
  const packageName = match[2];
  if (!productTitle || !packageName) {
    return { productTitle: title };
  }
  return { productTitle: productTitle.trim(), packageName: packageName.trim() };
}

/** Delivery dropdown label — hides numeric supplier/variation codes in parentheses. */
export function formatOrderItemDeliveryLabel(title: string): string {
  const { productTitle, packageName } = parseOrderItemPackage(title);
  if (!packageName) return productTitle;
  if (/^\d+$/.test(packageName.trim())) return productTitle;
  return `${productTitle} (${packageName})`;
}

/** Human-readable package label for order line titles. */
export function formatOrderPackageLabel(title: string): string | null {
  const { packageName } = parseOrderItemPackage(title);
  if (!packageName?.trim()) return null;
  if (/^\d+$/.test(packageName.trim())) return null;
  return packageName.trim();
}

function variationValueIdMatches(a: string, b: string): boolean {
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

/** Gift-card amount with $ prefix from an order line (title + catalog variation). */
export function resolveGiftCardAmountForOrderItem(
  item: Pick<OrderLine, "title" | "variationValueId" | "productId">,
  productAttributesByProductId?: Record<
    string,
    Record<string, unknown> | undefined
  >,
): string {
  const { packageName } = parseOrderItemPackage(item.title);
  if (packageName?.trim() && !/^\d+$/.test(packageName.trim())) {
    const fromPackage = resolveGiftCardAmountDisplay(packageName);
    if (fromPackage) return fromPackage;
  }

  const productId = normalizeOrderLineProductId(item.productId);
  const attributes = productAttributesByProductId?.[productId];
  const variationId = item.variationValueId?.trim();
  if (attributes && variationId) {
    const packages = inventoryManagedPackages({ attributes });
    const matchedPackage = packages.find((pkg) =>
      variationValueIdMatches(pkg.valueId, variationId),
    );
    if (matchedPackage?.name) {
      const fromVariation = resolveGiftCardAmountDisplay(matchedPackage.name);
      if (fromVariation) return fromVariation;
    }
  }

  if (packageName?.trim()) {
    return resolveGiftCardAmountDisplay(packageName);
  }

  return resolveGiftCardAmountDisplay(item.title);
}

/** @deprecated Use resolveGiftCardAmountForOrderItem for order lines. */
export function resolveGiftCardAmountFromOrderItemTitle(title: string): string {
  return resolveGiftCardAmountForOrderItem({ title, productId: "" });
}

/** Normalize order line productId for API paths (handles legacy ObjectId shapes). */
export function normalizeOrderLineProductId(productId: unknown): string {
  if (typeof productId === "string") return productId;
  if (
    productId &&
    typeof productId === "object" &&
    "_id" in productId &&
    (productId as { _id?: unknown })._id != null
  ) {
    return String((productId as { _id: unknown })._id);
  }
  return String(productId ?? "");
}

/**
 * Resolve the inventory package valueId for an order line.
 * Falls back to matching the package name from the order title when the stored id is missing or stale.
 */
export function resolveOrderLineInventoryVariationId(
  item: Pick<OrderLine, "title" | "variationValueId">,
  attributes?: Record<string, unknown>,
  deliveryType?: string,
): string | undefined {
  const packages = inventoryManagedPackages({
    attributes,
    deliveryType,
  });
  if (packages.length === 0) return undefined;

  const rawId = item.variationValueId?.trim();
  if (rawId) {
    const byId = packages.find((pkg) =>
      variationValueIdMatches(pkg.valueId, rawId),
    );
    if (byId) return byId.valueId;
  }

  const { packageName } = parseOrderItemPackage(item.title);
  if (packageName?.trim()) {
    const normalizedName = packageName.trim();
    const byName = packages.find(
      (pkg) => pkg.name.trim() === normalizedName,
    );
    if (byName) return byName.valueId;
  }

  if (packages.length === 1) return packages[0]?.valueId;
  return rawId || undefined;
}

export function formatAdminOrderPlaced(createdAt?: string): string {
  if (!createdAt) return "—";
  return new Date(createdAt).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatAdminPaymentWhen(
  paidAt: string | undefined,
  method: string,
): string {
  if (!paidAt) return method;
  const date = new Date(paidAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${date} via ${method.charAt(0).toUpperCase()}${method.slice(1)}`;
}

export const ADMIN_ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "delivered", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
] as const;

/** Safe quantity for order line display (legacy rows may omit the field). */
export function orderLineQuantity(quantity?: number): number {
  return typeof quantity === "number" &&
    Number.isFinite(quantity) &&
    quantity > 0
    ? Math.floor(quantity)
    : 1;
}
