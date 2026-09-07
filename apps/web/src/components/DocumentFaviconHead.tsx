"use client";

import { useLayoutEffect } from "react";
import { syncDocumentFavicon } from "@/lib/favicon-utils";
import { publicFaviconLinkMime } from "@/lib/public-favicon";
import { SITE_FAVICON_PATH } from "@/lib/site-favicon";
import { useAdminFaviconStore } from "@/stores/admin-favicon-store";

/** Keeps the browser tab icon synced with the admin-uploaded site favicon everywhere. */
export function DocumentFaviconHead() {
  const adminFaviconUrl = useAdminFaviconStore((s) => s.adminFaviconUrl);

  useLayoutEffect(() => {
    const trimmed = adminFaviconUrl?.trim() ?? "";
    syncDocumentFavicon({
      href: SITE_FAVICON_PATH,
      type: trimmed ? publicFaviconLinkMime(trimmed) : "image/png",
      linkIdPrefix: "site-favicon",
    });
  }, [adminFaviconUrl]);

  return null;
}
