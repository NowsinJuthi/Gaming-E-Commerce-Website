"use client";

import { memo } from "react";
import { GridIcon } from "@/components/admin/icons";
import { publicAdminFaviconHref } from "@/lib/admin-favicon";

type Props = {
  adminFaviconUrl?: string;
  /** Icon box size class (wrapper). */
  className?: string;
  /** Inner mark size — img or svg. */
  markClassName?: string;
  /** Skip outer box — for AdminOrderStatField which supplies its own wrapper. */
  bare?: boolean;
};

/** Grid placeholder when unset; uploaded favicon preview when configured. */
export const AdminFaviconMark = memo(function AdminFaviconMark({
  adminFaviconUrl,
  className = "dashboard-pro-section-icon",
  markClassName = "h-4 w-4",
  bare = false,
}: Props) {
  const trimmed = adminFaviconUrl?.trim() ?? "";
  const mark = trimmed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={publicAdminFaviconHref(trimmed)}
      alt=""
      className={`${markClassName} rounded object-contain`}
    />
  ) : (
    <GridIcon className={markClassName} />
  );

  if (bare) return mark;

  return (
    <span className={className} aria-hidden>
      {mark}
    </span>
  );
});
