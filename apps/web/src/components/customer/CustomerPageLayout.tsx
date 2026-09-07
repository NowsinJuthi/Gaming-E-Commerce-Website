"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GridIcon } from "@/components/admin/icons";
import { getCustomerNavIcon } from "@/lib/customer-nav";

type Props = {
  section?: string;
  title: string;
  description?: string;
  iconKey?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  /** Replaces the default hero on all breakpoints. */
  unifiedHeader?: ReactNode;
  /** Full mobile-only header card (replaces hero on small screens). */
  mobileUnifiedHeader?: ReactNode;
  kickerClassName?: string;
  /** Replaces default `shell-panel` on the page hero (e.g. elevated contact card). */
  heroSurfaceClassName?: string;
  heroClassName?: string;
  children?: ReactNode;
  loading?: boolean;
  loadingText?: string;
};

export function CustomerPageLayout({
  section = "Account",
  title,
  description,
  iconKey,
  backHref,
  backLabel = "Dashboard",
  action,
  mobileUnifiedHeader,
  unifiedHeader,
  kickerClassName,
  heroSurfaceClassName,
  heroClassName,
  children,
  loading = false,
  loadingText = "Loading…",
}: Props) {
  const Icon = iconKey ? getCustomerNavIcon(iconKey) : GridIcon;

  if (loading) {
    return (
      <div className="admin-page-shell w-full min-w-0">
        <div className="shell-panel admin-page-loading border-dashed p-10 text-center text-sm text-foreground-muted">
          {loadingText}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-shell w-full min-w-0 space-y-3 sm:space-y-4 lg:space-y-6">
      {unifiedHeader ? <div>{unifiedHeader}</div> : null}
      {!unifiedHeader && mobileUnifiedHeader ? (
        <div className="lg:hidden">{mobileUnifiedHeader}</div>
      ) : null}
      {!unifiedHeader ? (
        <div
          className={`${heroSurfaceClassName ?? "shell-panel"} admin-page-hero p-3 sm:p-4 md:p-5 lg:p-6 ${heroClassName ?? ""}${
            mobileUnifiedHeader ? " hidden lg:block" : ""
          }`.trim()}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="panel-page-icon shrink-0" aria-hidden>
              <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
            </span>
            <div className="admin-page-hero-main flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="admin-page-hero-text min-w-0">
                {section ? (
                  <p className={`admin-page-kicker ${kickerClassName ?? ""}`.trim()}>
                    {section}
                  </p>
                ) : null}
                <h1 className="admin-page-title">{title}</h1>
                {description ? (
                  <p className="admin-page-description">{description}</p>
                ) : null}
              </div>
              {backHref || action ? (
                <div className="admin-page-hero-actions flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {backHref ? (
                    <Link
                      href={backHref as "/"}
                      className="dashboard-pro-btn-ghost shrink-0"
                    >
                      ← {backLabel}
                    </Link>
                  ) : null}
                  {action}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="admin-page-content flex flex-col gap-3 sm:gap-4 lg:gap-6">
        {children}
      </div>
    </div>
  );
}
