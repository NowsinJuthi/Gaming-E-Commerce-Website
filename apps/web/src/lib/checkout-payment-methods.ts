import type { CustomerPanelConfig, PaymentMethodValue } from "@/lib/api";

export type CheckoutPaymentMethods = {
  walletEnabled: boolean;
  gatewayEnabled: boolean;
  manualEnabled: boolean;
};

export const DEFAULT_PAYMENT_METHOD_ORDER: PaymentMethodValue[] = [
  "wallet",
  "gateway",
  "manual",
];

export const CHECKOUT_PAYMENT_METHOD_OPTIONS: Array<{
  value: PaymentMethodValue;
  label: string;
  checkoutTitle: string;
  checkoutSubtitle?: string;
  flag: keyof CheckoutPaymentMethods;
}> = [
  {
    value: "wallet",
    label: "Wallet Balance",
    checkoutTitle: "Wallet Balance",
    flag: "walletEnabled",
  },
  {
    value: "gateway",
    label: "Online gateway",
    checkoutTitle: "bKash / Nagad",
    checkoutSubtitle: "Pay Money And Verify With TrxID",
    flag: "gatewayEnabled",
  },
  {
    value: "manual",
    label: "Manual / bank transfer",
    checkoutTitle: "Manual / bank transfer",
    checkoutSubtitle: "Pay offline and confirm",
    flag: "manualEnabled",
  },
];

const OPTION_BY_VALUE = new Map(
  CHECKOUT_PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option]),
);

export function normalizePaymentMethodOrder(
  order?: PaymentMethodValue[] | null,
): PaymentMethodValue[] {
  const seen = new Set<PaymentMethodValue>();
  const normalized: PaymentMethodValue[] = [];

  for (const value of (Array.isArray(order) ? order : [])) {
    if (!OPTION_BY_VALUE.has(value) || seen.has(value)) continue;
    normalized.push(value);
    seen.add(value);
  }

  for (const value of DEFAULT_PAYMENT_METHOD_ORDER) {
    if (!seen.has(value)) normalized.push(value);
  }

  return normalized;
}

export function paymentMethodOrderFromConfig(
  config: CustomerPanelConfig | null | undefined,
): PaymentMethodValue[] {
  return normalizePaymentMethodOrder(config?.checkout.paymentMethodOrder);
}

export function checkoutMethodsFromConfig(
  config: CustomerPanelConfig | null | undefined,
): CheckoutPaymentMethods {
  return {
    walletEnabled: config?.checkout.walletEnabled !== false,
    gatewayEnabled: config?.checkout.gatewayEnabled !== false,
    manualEnabled: config?.checkout.manualEnabled !== false,
  };
}

export function isPaymentMethodEnabled(
  method: PaymentMethodValue,
  methods: CheckoutPaymentMethods,
): boolean {
  if (method === "wallet") return methods.walletEnabled;
  if (method === "gateway") return methods.gatewayEnabled;
  if (method === "manual") return methods.manualEnabled;
  return false;
}

export function orderedCheckoutPaymentOptions(
  methods: CheckoutPaymentMethods,
  order?: PaymentMethodValue[] | null,
) {
  return normalizePaymentMethodOrder(order).flatMap((value) => {
    const option = OPTION_BY_VALUE.get(value);
    if (!option || !methods[option.flag]) return [];
    return [option];
  });
}

export function countEnabledCheckoutMethods(
  methods: CheckoutPaymentMethods,
): number {
  return CHECKOUT_PAYMENT_METHOD_OPTIONS.filter((option) => methods[option.flag])
    .length;
}

export function resolveDefaultPaymentMethod(
  methods: CheckoutPaymentMethods,
  preferred?: PaymentMethodValue,
  order?: PaymentMethodValue[] | null,
): PaymentMethodValue | null {
  if (preferred && isPaymentMethodEnabled(preferred, methods)) {
    return preferred;
  }
  for (const option of orderedCheckoutPaymentOptions(methods, order)) {
    return option.value;
  }
  return null;
}

export function movePaymentMethodOrder(
  order: PaymentMethodValue[],
  value: PaymentMethodValue,
  direction: "up" | "down",
): PaymentMethodValue[] {
  const next = normalizePaymentMethodOrder(order);
  const index = next.indexOf(value);
  if (index < 0) return next;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= next.length) return next;

  const current = next[index];
  const adjacent = next[swapWith];
  if (!current || !adjacent) return next;
  next[index] = adjacent;
  next[swapWith] = current;
  return next;
}
