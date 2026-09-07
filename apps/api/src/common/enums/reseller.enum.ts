export enum ResellerStatus {
  Pending = 'pending',
  Active = 'active',
  Suspended = 'suspended',
}

export enum ResellerTier {
  Standard = 'standard',
  Silver = 'silver',
  Gold = 'gold',
  Platinum = 'platinum',
}

export enum ResellerOrderStatus {
  Pending = 'pending',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum ResellerOrderSource {
  Dashboard = 'dashboard',
  Api = 'api',
}
