"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AppearanceProvider } from "@/components/admin/appearance/AppearanceProvider";
import { getAppearanceMeta } from "@/lib/appearance-nav";

export default function AppearanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const meta = getAppearanceMeta(pathname);

  return (
    <AdminPageLayout
      section="System"
      title={meta.label}
      description={meta.description}
      icon={meta.icon}
      backHref="/admin/settings"
      backLabel="Settings"
    >
      <AppearanceProvider>
        <div className="admin-appearance-stack w-full space-y-6">
          {children}
        </div>
      </AppearanceProvider>
    </AdminPageLayout>
  );
}
