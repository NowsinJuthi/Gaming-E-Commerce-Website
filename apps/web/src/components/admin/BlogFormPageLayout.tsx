"use client";

import type { ReactNode } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { LinkIcon } from "@/components/admin/icons";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { CONTACT_EMAIL_CARD_SURFACE_CLASS } from "@/components/contact/contact-email-card";

type BlogFormPageLayoutProps = {
  isCustomerWorkspace: boolean;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  iconKey?: string;
  action?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  children?: ReactNode;
};

export function BlogFormPageLayout({
  isCustomerWorkspace,
  title,
  description,
  backHref,
  backLabel = "Blog",
  iconKey,
  action,
  loading,
  loadingText,
  children,
}: BlogFormPageLayoutProps) {
  if (isCustomerWorkspace) {
    return (
      <CustomerPageLayout
        section=""
        iconKey={iconKey ?? "blog"}
        title={title}
        description={description}
        backHref={backHref}
        backLabel={backLabel}
        action={action}
        heroSurfaceClassName={CONTACT_EMAIL_CARD_SURFACE_CLASS}
        loading={loading}
        loadingText={loadingText}
      >
        {children}
      </CustomerPageLayout>
    );
  }

  return (
    <AdminPageLayout
      section="Content"
      title={title}
      description={description}
      icon={LinkIcon}
      backHref={backHref}
      backLabel={backLabel}
      action={action}
      loading={loading}
      loadingText={loadingText}
    >
      {children}
    </AdminPageLayout>
  );
}
