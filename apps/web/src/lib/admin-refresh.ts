/** Dispatched from the admin header refresh button before a hard reload. */
export const ADMIN_PAGE_REFRESH_EVENT = "admin:page-refresh";

export function dispatchAdminPageRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_PAGE_REFRESH_EVENT));
}
