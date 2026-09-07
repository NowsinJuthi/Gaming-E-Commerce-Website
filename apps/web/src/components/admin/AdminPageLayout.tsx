"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { GridIcon } from "@/components/admin/icons";
import type { AdminIcon } from "@/lib/admin-nav";
import { getAdminPageMeta, getBreadcrumbs } from "@/lib/admin-nav";
import { getEmailSettingsPageMeta } from "@/lib/email-settings-nav";
import { resolveAvatarSrc } from "@/lib/site-appearance";

type Props = {
  section?: string;
  title?: string;
  description?: string;
  icon?: AdminIcon;
  heroImageUrl?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  hideHeader?: boolean;
  className?: string;
  heroClassName?: string;
};

export function AdminPageLayout({
  section: sectionProp,
  title,
  description,
  icon: iconProp,
  heroImageUrl,
  backHref,
  backLabel = "Dashboard",
  action,
  children,
  loading = false,
  loadingText = "Loading…",
  hideHeader = false,
  className = "",
  heroClassName = "",
}: Props) {
  const pathname = usePathname();
  const meta = getAdminPageMeta(pathname);
  const emailMeta = getEmailSettingsPageMeta(pathname);
  const crumbs = getBreadcrumbs(pathname);
  const section = sectionProp ?? meta.section;
  const Icon = iconProp ?? meta.icon ?? GridIcon;
  const pageTitle = title ?? emailMeta?.title ?? meta.title;
  const pageDescription = description ?? emailMeta?.description;
  const heroAvatar = heroImageUrl?.trim() || "";

  if (loading) {
    return (
      <div
        className="admin-page-shell w-full min-w-0"
      >
        <div className="shell-panel admin-page-loading border-dashed p-10 text-center text-sm text-foreground-muted">
          {loadingText}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`admin-page-shell w-full min-w-0 space-y-6${className ? ` ${className}` : ""}`}
    >
      {!hideHeader ? (
        <div
          className={`shell-panel admin-page-hero p-4 sm:p-5 md:p-6${heroClassName ? ` ${heroClassName}` : ""}`}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <span
              className={`panel-page-icon shrink-0 overflow-hidden${
                heroAvatar ? " panel-page-icon--avatar" : ""
              }`}
              aria-hidden
            >
              {heroAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveAvatarSrc(heroAvatar)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
              )}
            </span>
            <div className="admin-page-hero-main flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="admin-page-hero-text min-w-0">
                {crumbs.length === 0 || pathname === "/admin" ? (
                  <p className="admin-page-kicker">{section}</p>
                ) : null}
                <h1 className="admin-page-title">{pageTitle}</h1>
                {pageDescription ? (
                  <p className="admin-page-description">{pageDescription}</p>
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
      <div className="admin-page-content flex flex-col gap-6">{children}</div>
    </div>
  );
}
