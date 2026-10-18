export const ROLE_PERMISSIONS_KEY = 'global';

export const GUEST_STOREFRONT_PERMISSION_KEYS = [
  'guest_browse_storefront',
  'guest_use_cart',
  'guest_checkout',
  'guest_live_chat',
  'guest_view_media',
] as const;

export type GuestStorefrontPermissionKey =
  (typeof GUEST_STOREFRONT_PERMISSION_KEYS)[number];

export const ADMIN_ROLE_IDS = [
  'shop_manager',
  'guest',
  'customer',
  'vip',
  'reseller',
  'affiliate',
  'supplier',
  'subscriber',
  'contributor',
  'author',
  'blogger',
  'editor',
  'movie_server',
  'administrator',
] as const;

export type AdminRoleId = (typeof ADMIN_ROLE_IDS)[number];

export const PERMISSION_KEYS = [
  'admin_panel_access',
  'dashboard_analytics',
  'view_products',
  'create_edit_products',
  'delete_deactivate_products',
  'submit_product_drafts',
  'gift_card_inventory',
  'view_all_orders',
  'update_order_status',
  'approve_mfs_payments',
  'view_customers',
  'edit_customers_wallet',
  'auto_delivery',
  'manage_security_settings',
  'manage_roles_permissions',
  'view_audit_logs',
  'manage_appearance_theme',
  'manage_email_settings',
  'manage_general_settings',
  'view_blog_overview',
  'view_blog_posts',
  'create_edit_blog_posts',
  'publish_blog_posts',
  'delete_blog_posts',
  'manage_blog_categories',
  'view_media_catalog',
  'manage_media_catalog',
  'manage_media_collections',
  'manage_media_genres',
  'manage_media_home',
  'manage_media_libraries',
  'upload_media_files',
  'manage_media_files',
  'view_media_playback',
  'view_media_subscriptions',
  'manage_media_subscriptions',
  'guest_browse_storefront',
  'guest_use_cart',
  'guest_checkout',
  'guest_live_chat',
  'guest_view_media',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const BLOG_PERMISSION_KEYS: readonly PermissionKey[] = [
  'view_blog_overview',
  'view_blog_posts',
  'create_edit_blog_posts',
  'publish_blog_posts',
  'delete_blog_posts',
  'manage_blog_categories',
];

export const PERMISSION_GROUPS: Array<{
  key: string;
  label: string;
  permissions: Array<{
    key: PermissionKey;
    label: string;
    description: string;
  }>;
}> = [
  {
    key: 'admin_panel',
    label: 'ADMIN PANEL',
    permissions: [
      {
        key: 'admin_panel_access',
        label: 'Admin panel access',
        description: 'Open the administration area',
      },
      {
        key: 'dashboard_analytics',
        label: 'Dashboard & analytics',
        description: 'View dashboard KPIs and reports',
      },
    ],
  },
  {
    key: 'catalog',
    label: 'CATALOG',
    permissions: [
      {
        key: 'view_products',
        label: 'View products',
        description: 'Browse the product catalog in admin',
      },
      {
        key: 'create_edit_products',
        label: 'Create & edit products',
        description: 'Add or update product listings',
      },
      {
        key: 'delete_deactivate_products',
        label: 'Delete / deactivate products',
        description: 'Remove or unpublish products',
      },
      {
        key: 'submit_product_drafts',
        label: 'Submit product drafts',
        description: 'Submit products for review',
      },
      {
        key: 'gift_card_inventory',
        label: 'Gift card inventory',
        description: 'Manage gift card stock and codes',
      },
    ],
  },
  {
    key: 'blog',
    label: 'BLOG',
    permissions: [
      {
        key: 'view_blog_overview',
        label: 'Blog overview',
        description: 'View blog stats, quick links, and activity summary',
      },
      {
        key: 'view_blog_posts',
        label: 'View blog posts',
        description: 'Browse blog posts in admin',
      },
      {
        key: 'create_edit_blog_posts',
        label: 'Create & edit blog posts',
        description: 'Write and update articles (submits for review without publish permission)',
      },
      {
        key: 'publish_blog_posts',
        label: 'Publish & approve blog posts',
        description: 'Approve pending posts and publish directly',
      },
      {
        key: 'delete_blog_posts',
        label: 'Delete blog posts',
        description: 'Permanently remove blog posts',
      },
      {
        key: 'manage_blog_categories',
        label: 'Manage blog categories',
        description: 'Create, edit, and delete blog categories',
      },
    ],
  },
  {
    key: 'sales',
    label: 'SALES',
    permissions: [
      {
        key: 'view_all_orders',
        label: 'View all orders',
        description: 'See every customer order',
      },
      {
        key: 'update_order_status',
        label: 'Update order status',
        description: 'Change fulfillment and delivery status',
      },
      {
        key: 'approve_mfs_payments',
        label: 'Approve MFS payments',
        description:
          'Manually settle bKash/Nagad/Rocket/Upay intents. Support and Editor cannot hold this grant.',
      },
    ],
  },
  {
    key: 'customers',
    label: 'CUSTOMERS',
    permissions: [
      {
        key: 'view_customers',
        label: 'View customers',
        description: 'Browse customer accounts',
      },
      {
        key: 'edit_customers_wallet',
        label: 'Edit customers & wallet',
        description: 'Update profiles and wallet balance',
      },
      {
        key: 'auto_delivery',
        label: 'Auto delivery',
        description:
          'Orders are fulfilled automatically after payment (others stay pending manual delivery)',
      },
    ],
  },
  {
    key: 'security',
    label: 'SECURITY',
    permissions: [
      {
        key: 'manage_security_settings',
        label: 'Security settings',
        description: 'Rate limits, reCAPTCHA, audit logs',
      },
      {
        key: 'manage_roles_permissions',
        label: 'Roles & permissions',
        description: 'Configure role access levels',
      },
      {
        key: 'view_audit_logs',
        label: 'View audit logs',
        description: 'Read security and activity logs',
      },
    ],
  },
  {
    key: 'movie_server_catalog',
    label: 'MOVIE SERVER — CATALOG',
    permissions: [
      {
        key: 'view_media_catalog',
        label: 'View media catalog',
        description: 'Browse movies, series, and titles in admin',
      },
      {
        key: 'manage_media_catalog',
        label: 'Manage media catalog',
        description: 'Create, edit, publish, and remove catalog titles',
      },
      {
        key: 'manage_media_collections',
        label: 'Manage collections',
        description: 'Curate movie and series collections',
      },
      {
        key: 'manage_media_genres',
        label: 'Genres & metadata',
        description: 'Manage genres, tags, and catalog metadata',
      },
      {
        key: 'manage_media_home',
        label: 'Media homepage',
        description: 'Featured rows and /media browse layout',
      },
    ],
  },
  {
    key: 'movie_server_library',
    label: 'MOVIE SERVER — LIBRARY & UPLOAD',
    permissions: [
      {
        key: 'manage_media_libraries',
        label: 'Media libraries',
        description: 'Add libraries, scan folders, and link storage',
      },
      {
        key: 'upload_media_files',
        label: 'Upload media files',
        description: 'Upload videos to configured storage (no delete)',
      },
      {
        key: 'manage_media_files',
        label: 'Manage media files',
        description: 'Full file manager — upload, link, and remove files',
      },
      {
        key: 'view_media_playback',
        label: 'Playback & streams',
        description: 'Monitor active playback and stream sessions',
      },
    ],
  },
  {
    key: 'movie_server_accounts',
    label: 'MOVIE SERVER — SUBSCRIPTIONS',
    permissions: [
      {
        key: 'view_media_subscriptions',
        label: 'View media subscriptions',
        description: 'Browse movie server plan subscriptions',
      },
      {
        key: 'manage_media_subscriptions',
        label: 'Manage media subscriptions',
        description: 'Grant, suspend, and edit media subscriptions',
      },
    ],
  },
  {
    key: 'guest_storefront',
    label: 'GUEST STOREFRONT',
    permissions: [
      {
        key: 'guest_browse_storefront',
        label: 'Browse storefront',
        description: 'View products, categories, and public pages without logging in',
      },
      {
        key: 'guest_use_cart',
        label: 'Use cart',
        description: 'Add items to cart as a guest session',
      },
      {
        key: 'guest_checkout',
        label: 'Guest checkout',
        description:
          'Allow ordering without an account (replaces the old Payment gateways toggle)',
      },
      {
        key: 'guest_live_chat',
        label: 'Guest live chat',
        description: 'Open live chat without registering',
      },
      {
        key: 'guest_view_media',
        label: 'Browse media catalog',
        description: 'View /media movies and series as a guest',
      },
    ],
  },
  {
    key: 'settings',
    label: 'SETTINGS',
    permissions: [
      {
        key: 'manage_appearance_theme',
        label: 'Appearance & theme',
        description: 'Storefront theme and branding',
      },
      {
        key: 'manage_email_settings',
        label: 'Email settings',
        description: 'SMTP and notification templates',
      },
      {
        key: 'manage_general_settings',
        label: 'General site settings',
        description: 'Payments, delivery, and suppliers',
      },
    ],
  },
];

export const ROLE_DEFINITIONS: Array<{
  id: AdminRoleId;
  label: string;
  description: string;
  locked: boolean;
  summary: string[];
}> = [
  {
    id: 'shop_manager',
    label: 'Shop manager',
    description: 'Full shop operations without site-wide settings.',
    locked: false,
    summary: [
      'Access admin panel, dashboard, and analytics.',
      'Manage products, orders, and gift card stock.',
      'View and edit customer accounts and wallet balance.',
      'Cannot change appearance, theme, or email settings.',
    ],
  },
  {
    id: 'customer',
    label: 'Customer',
    description: 'Storefront buyer with no admin access.',
    locked: false,
    summary: [
      'Browse and purchase on the storefront.',
      'Manage own orders, wallet, and profile.',
      'No access to the admin panel.',
    ],
  },
  {
    id: 'guest',
    label: 'Guest',
    description:
      'Ephemeral checkout and chat sessions — limit what visitors can do before they register.',
    locked: false,
    summary: [
      'Applies to guest checkout and guest chat JWT sessions.',
      'Toggle cart, checkout, chat, and media browsing independently.',
      'Guest checkout replaces the old Payment gateways “order without account” toggle.',
      'Guest live chat still respects Customer panel / Live chat guest switch.',
      'No admin panel access.',
    ],
  },
  {
    id: 'vip',
    label: 'VIP',
    description: 'Premium customer with priority support and exclusive benefits.',
    locked: false,
    summary: [
      'All standard storefront account features.',
      'VIP status for priority orders and support.',
      'Auto delivery enabled after payment by default.',
      'Manage own orders, wallet, and profile.',
      'No access to the admin panel.',
    ],
  },
  {
    id: 'reseller',
    label: 'Reseller',
    description: 'Bulk buyer with programmatic API access and reseller pricing.',
    locked: false,
    summary: [
      'Reseller dashboard and API on the storefront.',
      'Wallet-funded bulk orders at reseller rates.',
      'No admin panel access by default.',
    ],
  },
  {
    id: 'affiliate',
    label: 'Affiliate',
    description: 'Referral partner earning commission on referred sales.',
    locked: false,
    summary: [
      'Affiliate dashboard, referral links, and payouts.',
      'Commission tracking on qualifying orders.',
      'No admin panel access by default.',
    ],
  },
  {
    id: 'supplier',
    label: 'Supplier',
    description: 'External fulfillment partner for digital goods delivery.',
    locked: false,
    summary: [
      'Linked to supplier integrations for order fulfillment.',
      'Storefront/program access only by default.',
      'Grant admin permissions here if staff oversight is needed.',
    ],
  },
  {
    id: 'subscriber',
    label: 'Subscriber',
    description: 'Registered user with newsletter and account access.',
    locked: false,
    summary: [
      'Storefront account and order history.',
      'No admin panel access.',
    ],
  },
  {
    id: 'contributor',
    label: 'Contributor',
    description: 'Can submit product drafts for review.',
    locked: false,
    summary: [
      'Submit product drafts for approval.',
      'Create blog drafts for review.',
      'No admin panel or site-wide settings access.',
    ],
  },
  {
    id: 'author',
    label: 'Author',
    description: 'Create and publish own product listings.',
    locked: false,
    summary: [
      'Create and edit own products.',
      'Submit drafts and manage own catalog items.',
      'Create and edit blog posts (no delete).',
    ],
  },
  {
    id: 'blogger',
    label: 'Blogger',
    description: 'Dedicated blog writer — submit posts for admin review.',
    locked: false,
    summary: [
      'Write blog posts from the customer dashboard.',
      'View and create blog posts (approval required).',
      'No admin panel or site-wide settings access.',
    ],
  },
  {
    id: 'editor',
    label: 'Editor',
    description: 'Manage catalog and moderate content.',
    locked: false,
    summary: [
      'Full catalog management.',
      'View orders and customer data.',
      'Blog overview, posts, and categories.',
      'No security or site-wide settings.',
    ],
  },
  {
    id: 'movie_server',
    label: 'Movie Server',
    description:
      'Full Movie Server staff — catalog, libraries, uploads, playback, and subscriptions.',
    locked: false,
    summary: [
      'Manage movies, series, collections, genres, and /media homepage.',
      'Configure libraries, upload files, and manage media storage.',
      'Monitor playback streams and media subscription accounts.',
      'No shop catalog, orders, or site-wide security settings by default.',
    ],
  },
  {
    id: 'administrator',
    label: 'Administrator',
    description: 'Full access to all admin features.',
    locked: true,
    summary: [
      'Unrestricted access to every admin area.',
      'Manage roles, security, and site settings.',
      'This role cannot be restricted.',
    ],
  },
];

function allPermissions(value: boolean): Record<PermissionKey, boolean> {
  return Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, value]),
  ) as Record<PermissionKey, boolean>;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<
  AdminRoleId,
  Record<PermissionKey, boolean>
> = {
  shop_manager: {
    ...allPermissions(false),
    admin_panel_access: true,
    dashboard_analytics: true,
    view_products: true,
    create_edit_products: true,
    delete_deactivate_products: true,
    gift_card_inventory: true,
    view_all_orders: true,
    update_order_status: true,
    view_customers: true,
    edit_customers_wallet: true,
    view_blog_posts: true,
  },
  customer: allPermissions(false),
  guest: {
    ...allPermissions(false),
    guest_browse_storefront: true,
    guest_use_cart: true,
    guest_checkout: true,
    guest_live_chat: true,
    guest_view_media: true,
  },
  vip: {
    ...allPermissions(false),
    auto_delivery: true,
  },
  reseller: allPermissions(false),
  affiliate: allPermissions(false),
  supplier: allPermissions(false),
  subscriber: allPermissions(false),
  contributor: {
    ...allPermissions(false),
    submit_product_drafts: true,
    view_blog_posts: true,
    create_edit_blog_posts: true,
  },
  author: {
    ...allPermissions(false),
    admin_panel_access: true,
    view_products: true,
    create_edit_products: true,
    submit_product_drafts: true,
    view_blog_posts: true,
    create_edit_blog_posts: true,
  },
  blogger: {
    ...allPermissions(false),
    view_blog_posts: true,
    create_edit_blog_posts: true,
  },
  editor: {
    ...allPermissions(false),
    admin_panel_access: true,
    dashboard_analytics: true,
    view_products: true,
    create_edit_products: true,
    delete_deactivate_products: true,
    gift_card_inventory: true,
    view_all_orders: true,
    view_customers: true,
    view_blog_overview: true,
    view_blog_posts: true,
    create_edit_blog_posts: true,
    publish_blog_posts: true,
    delete_blog_posts: true,
    manage_blog_categories: true,
  },
  movie_server: {
    ...allPermissions(false),
    admin_panel_access: true,
    dashboard_analytics: true,
    view_media_catalog: true,
    manage_media_catalog: true,
    manage_media_collections: true,
    manage_media_genres: true,
    manage_media_home: true,
    manage_media_libraries: true,
    upload_media_files: true,
    manage_media_files: true,
    view_media_playback: true,
    view_media_subscriptions: true,
    manage_media_subscriptions: true,
  },
  administrator: allPermissions(true),
};

/** Maps storefront user roles to role-permission profiles. */
export const USER_ROLE_TO_PERMISSION_ROLE: Record<string, AdminRoleId | undefined> =
  {
    guest: 'guest',
    customer: 'customer',
    vip: 'vip',
    reseller: 'reseller',
    affiliate: 'affiliate',
    supplier: 'supplier',
    contributor: 'contributor',
    blogger: 'blogger',
    movie_server: 'movie_server',
    content_manager: 'movie_server',
    library_manager: 'movie_server',
    media_uploader: 'movie_server',
    media_support: 'movie_server',
    admin: 'administrator',
    support: 'editor',
  };
