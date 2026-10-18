import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Media catalog triggers WebKit hit-test bugs with client-side nav from the header. */
export function isMediaCatalogPath(pathname: string | null | undefined): boolean {
  return pathname === "/media";
}

/** Client navigate away from /media (avoids full reload flash). */
export function hardNavigateFromMediaCatalog(
  pathname: string | null | undefined,
  href: string,
  router: Pick<AppRouterInstance, "push">,
  event?: { preventDefault(): void },
): boolean {
  if (!isMediaCatalogPath(pathname)) return false;
  event?.preventDefault();
  document.documentElement.classList.remove("media-catalog-route");
  router.push(href);
  return true;
}
