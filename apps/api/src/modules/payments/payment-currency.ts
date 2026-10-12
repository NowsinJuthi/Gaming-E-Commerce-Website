import { DEFAULT_CURRENCY } from '@uniqbd/types';

export const SUPPORTED_PAYMENT_CURRENCIES = [DEFAULT_CURRENCY] as const;
export type SupportedPaymentCurrency = (typeof SUPPORTED_PAYMENT_CURRENCIES)[number];

export function normalizePaymentCurrency(value?: string | null): string {
  return (value ?? DEFAULT_CURRENCY).trim().toUpperCase();
}

export function isSupportedPaymentCurrency(value?: string | null): boolean {
  return SUPPORTED_PAYMENT_CURRENCIES.includes(
    normalizePaymentCurrency(value) as SupportedPaymentCurrency,
  );
}

export function paymentCurrenciesMatch(
  left?: string | null,
  right?: string | null,
): boolean {
  return normalizePaymentCurrency(left) === normalizePaymentCurrency(right);
}

/** Missing gateway currency is allowed; a provided mismatch is rejected. */
export function webhookCurrencyMatches(
  parsedCurrency: string | undefined,
  intentCurrency: string,
): boolean {
  if (!parsedCurrency?.trim()) return true;
  return paymentCurrenciesMatch(parsedCurrency, intentCurrency);
}
