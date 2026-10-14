/** Media catalog triggers WebKit hit-test bugs with client-side nav from the header. */
export function isMediaCatalogPath(pathname: string | null | undefined): boolean {
  return pathname === "/media";
}

export function hardNavigateFromMediaCatalog(
  pathname: string | null | undefined,
  href: string,
  event?: { preventDefault(): void },
): boolean {
  if (!isMediaCatalogPath(pathname)) return false;
  event?.preventDefault();
  window.location.assign(href);
  return true;
}
