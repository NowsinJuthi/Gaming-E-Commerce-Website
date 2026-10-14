/** Media catalog uses a WebKit pointer-events passthrough so header taps stay clickable. */
export function isMediaCatalogPath(pathname: string | null | undefined): boolean {
  return pathname === "/media";
}
