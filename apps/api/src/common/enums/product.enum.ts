export enum ProductType {
  License = 'license',
  Account = 'account',
  GiftCard = 'giftcard',
  TopUp = 'topup',
  Subscription = 'subscription',
}

export enum ProductStatus {
  Draft = 'draft',
  Active = 'active',
  OutOfStock = 'out_of_stock',
  Archived = 'archived',
}

export enum DeliveryType {
  Auto = 'auto',
  Manual = 'manual',
}

export enum InventoryStatus {
  Available = 'available',
  Reserved = 'reserved',
  Sold = 'sold',
  Disabled = 'disabled',
}
