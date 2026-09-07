"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminQuickLink } from "@/components/admin/admin-quick-links";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";

export type { AdminQuickLink } from "@/components/admin/admin-quick-links";
export {
  CATALOG_QUICK_LINKS,
  CUSTOMERS_QUICK_LINKS,
  EMAIL_QUICK_LINKS,
  SALES_QUICK_LINKS,
  SETTINGS_QUICK_LINKS,
  SUPPORT_QUICK_LINKS,
} from "@/components/admin/admin-quick-links";

export function AdminOrderStatField({
  icon,
  label,
  value,
  meta,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  meta?: string;
}) {
  return (
    <div className="admin-products-stat-field">
      {icon ? (
        <span className="admin-products-stat-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <dt>{label}</dt>
        <dd>{value}</dd>
        {meta ? <p className="admin-products-stat-meta">{meta}</p> : null}
      </div>
    </div>
  );
}

export function AdminOrderStatsGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={`admin-products-stats-grid ${className}`.trim()}>
      {children}
    </dl>
  );
}

export function AdminOrderPageIntro({
  icon,
  title,
  subtitle,
  quickLinks,
  quickNavLabel = "Shortcuts",
  className = "",
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  quickLinks?: readonly AdminQuickLink[];
  quickNavLabel?: string;
  className?: string;
}) {
  return (
    <ProductFormOrderCard
      wrapMain
      className={`admin-product-form-intro ${className}`.trim()}
      icon={icon}
      title={title}
      subtitle={subtitle}
    >
      {quickLinks && quickLinks.length > 0 ? (
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>{quickNavLabel}</dt>
          <dd className="admin-product-form-intro-links">
            <nav
              className="admin-products-quick-nav"
              aria-label={quickNavLabel}
            >
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={{ pathname: link.href }}
                  className="admin-products-quick-link"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </dd>
        </div>
      ) : null}
    </ProductFormOrderCard>
  );
}

export function AdminOrderTwoColumnLayout({
  main,
  sidebar,
}: {
  main: ReactNode;
  sidebar?: ReactNode;
}) {
  const layoutClass = sidebar
    ? "admin-product-form-layout admin-order-detail-layout"
    : "admin-product-form-layout";

  return (
    <div className={layoutClass}>
      <div className="admin-product-form-main admin-order-detail-main min-w-0 space-y-5">
        {main}
      </div>
      {sidebar ? (
        <aside className="admin-product-form-sidebar admin-order-detail-sidebar min-w-0 space-y-5">
          {sidebar}
        </aside>
      ) : null}
    </div>
  );
}

export function AdminOrderListCard({
  icon,
  title,
  subtitle,
  action,
  children,
  className = "",
  hideHeader = false,
  flatBody = false,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  hideHeader?: boolean;
  flatBody?: boolean;
}) {
  return (
    <ProductFormOrderCard
      className={`admin-product-form-section admin-order-list-card ${className}`.trim()}
      icon={icon}
      title={title}
      subtitle={subtitle}
      action={action}
      hideHeader={hideHeader}
      flatBody={flatBody}
    >
      {children}
    </ProductFormOrderCard>
  );
}
