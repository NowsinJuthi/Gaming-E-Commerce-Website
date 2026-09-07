export enum SupplierCode {
  Reloadly = 'reloadly',
  Xsolla = 'xsolla',
  Turgame = 'turgame',
  FoxReload = 'foxreload',
}

export enum SupplierStatus {
  Active = 'active',
  Disabled = 'disabled',
}

export enum SupplierStockStatus {
  InStock = 'in_stock',
  OutOfStock = 'out_of_stock',
  Unknown = 'unknown',
}

export enum SupplierOrderStatus {
  Pending = 'pending',
  Success = 'success',
  Failed = 'failed',
}
