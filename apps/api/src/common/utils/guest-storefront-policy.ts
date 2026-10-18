export type GuestStorefrontPermissions = {
  guest_browse_storefront: boolean;
  guest_use_cart: boolean;
  guest_checkout: boolean;
  guest_live_chat: boolean;
  guest_view_media: boolean;
};

/** Site-wide effective limits (Roles → Guest profile). */
export function resolveEffectiveGuestStorefrontPermissions(
  role: GuestStorefrontPermissions,
): GuestStorefrontPermissions {
  const browse = Boolean(role.guest_browse_storefront);
  const shop = browse && Boolean(role.guest_checkout);
  return {
    guest_browse_storefront: browse,
    guest_use_cart: shop,
    guest_checkout: shop,
    guest_live_chat: Boolean(role.guest_live_chat),
    guest_view_media: browse && Boolean(role.guest_view_media),
  };
}
