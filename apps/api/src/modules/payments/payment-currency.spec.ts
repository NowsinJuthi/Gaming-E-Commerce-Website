import {
  isSupportedPaymentCurrency,
  paymentCurrenciesMatch,
  webhookCurrencyMatches,
} from './payment-currency';

describe('payment currency', () => {
  it('allows only BDT', () => {
    expect(isSupportedPaymentCurrency('BDT')).toBe(true);
    expect(isSupportedPaymentCurrency('bdt')).toBe(true);
    expect(isSupportedPaymentCurrency('USD')).toBe(false);
    expect(isSupportedPaymentCurrency('EUR')).toBe(false);
  });

  it('requires order and payment currencies to match', () => {
    expect(paymentCurrenciesMatch('BDT', 'bdt')).toBe(true);
    expect(paymentCurrenciesMatch('BDT', 'USD')).toBe(false);
  });

  it('rejects a webhook currency mismatch and allows a missing currency', () => {
    expect(webhookCurrencyMatches(undefined, 'BDT')).toBe(true);
    expect(webhookCurrencyMatches('BDT', 'BDT')).toBe(true);
    expect(webhookCurrencyMatches('USD', 'BDT')).toBe(false);
  });
});
