/** Assignable user roles — aligned with admin permission profiles (+ legacy aliases). */
export enum Role {
  ShopManager = 'shop_manager',
  Customer = 'customer',
  Vip = 'vip',
  Reseller = 'reseller',
  Affiliate = 'affiliate',
  Supplier = 'supplier',
  Subscriber = 'subscriber',
  Contributor = 'contributor',
  Author = 'author',
  Blogger = 'blogger',
  Editor = 'editor',
  Administrator = 'administrator',
  /** @deprecated Prefer {@link Role.Administrator} */
  Admin = 'admin',
  /** @deprecated Prefer {@link Role.Editor} */
  Support = 'support',
}
