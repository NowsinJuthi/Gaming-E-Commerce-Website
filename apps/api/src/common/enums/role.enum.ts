/** Assignable user roles — aligned with admin permission profiles (+ legacy aliases). */
export enum Role {
  ShopManager = 'shop_manager',
  /** Ephemeral checkout / chat sessions (not assignable via admin user forms). */
  Guest = 'guest',
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
  ContentManager = 'content_manager',
  LibraryManager = 'library_manager',
  MediaUploader = 'media_uploader',
  MediaSupport = 'media_support',
  Administrator = 'administrator',
  /** @deprecated Prefer {@link Role.Administrator} */
  Admin = 'admin',
  /** @deprecated Prefer {@link Role.Editor} */
  Support = 'support',
}
