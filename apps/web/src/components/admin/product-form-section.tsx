"use client";

import type { ReactNode } from "react";

function ProductFormOrderCardHeader({
  icon,
  title,
  subtitle,
  action,
  iconClassName = "",
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  iconClassName?: string;
}) {
  return (
    <div className="dashboard-pro-section-head admin-order-view-pro-section-head admin-order-view-card-header">
      {icon ? (
        <span
          className={`dashboard-pro-section-icon ${iconClassName}`.trim()}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <div className="admin-order-view-section-copy min-w-0 flex-1">
        <h2 className="dashboard-pro-section-title">{title}</h2>
        {subtitle ? (
          <p className="dashboard-pro-section-sub">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Order items / New catalog item card shell. */
export function ProductFormOrderCard({
  icon,
  title,
  subtitle,
  action,
  children,
  className = "",
  iconClassName = "",
  wrapMain = false,
  showBody = true,
  flatBody = false,
  hideHeader = false,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  wrapMain?: boolean;
  showBody?: boolean;
  flatBody?: boolean;
  hideHeader?: boolean;
}) {
  const card = (
    <section
      className={`dashboard-pro-card admin-order-view-card admin-order-view-sidebar-card admin-order-view-sidebar-card--items admin-order-view-sidebar-card--pro ${className}`.trim()}
    >
      {hideHeader ? null : (
        <ProductFormOrderCardHeader
          icon={icon}
          title={title}
          subtitle={subtitle}
          action={action}
          iconClassName={iconClassName}
        />
      )}
      {showBody ? (
        <div className="admin-order-view-card-body">
          {flatBody ? (
            children
          ) : (
            <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
              {children}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );

  if (wrapMain) {
    return <div className="admin-order-detail-main mb-5">{card}</div>;
  }

  return card;
}
