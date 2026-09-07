export enum PaymentGateway {
  Bkash = 'bkash',
  Nagad = 'nagad',
  Rocket = 'rocket',
  Upay = 'upay',
  UddoktaPay = 'uddoktapay',
  /** Manual MFS checkout (bKash/Nagad send money + TrxID + SMS verify). */
  Mfs = 'mfs',
}
