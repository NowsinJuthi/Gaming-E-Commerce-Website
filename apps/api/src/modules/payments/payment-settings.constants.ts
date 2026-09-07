import { PaymentGateway } from '../../common/enums';

export const PAYMENT_SETTINGS_KEY = 'global';

export const PAYMENT_GATEWAY_ORDER: PaymentGateway[] = [
  PaymentGateway.Bkash,
  PaymentGateway.Nagad,
  PaymentGateway.Rocket,
  PaymentGateway.Upay,
  PaymentGateway.UddoktaPay,
];

export const PAYMENT_GATEWAY_LABELS: Record<PaymentGateway, string> = {
  [PaymentGateway.Mfs]: 'Manual MFS (bKash/Nagad)',
  [PaymentGateway.Bkash]: 'bKash',
  [PaymentGateway.Nagad]: 'Nagad',
  [PaymentGateway.Rocket]: 'Rocket',
  [PaymentGateway.Upay]: 'Upay',
  [PaymentGateway.UddoktaPay]: 'UddoktaPay',
};

export const PAYMENT_GATEWAY_HINTS: Record<PaymentGateway, string> = {
  [PaymentGateway.Mfs]:
    'Send money to your bKash/Nagad numbers; customer enters TrxID; SMS app verifies.',
  [PaymentGateway.Bkash]:
    'Direct bKash checkout API. Requires app key, secret, username, and password.',
  [PaymentGateway.Nagad]:
    'Nagad merchant checkout. Merchant ID maps to API key; private key to API secret.',
  [PaymentGateway.Rocket]:
    'Dutch-Bangla Rocket merchant API credentials.',
  [PaymentGateway.Upay]:
    'Upay merchant gateway credentials.',
  [PaymentGateway.UddoktaPay]:
    'Aggregator for bKash, Nagad, Rocket, and Upay via a single API key.',
};
