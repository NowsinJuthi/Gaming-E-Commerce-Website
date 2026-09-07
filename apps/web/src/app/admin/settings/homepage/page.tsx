"use client";

import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { HomepageSliderSettingsPanel } from "@/components/admin/homepage/HomepageSliderSettingsPanel";
import { ImageAttachIcon } from "@/components/admin/icons";

export default function HomepageSliderSettingsPage() {
  return (
    <AdminPageLayout
      section="Settings"
      title="Homepage slider"
      description="Manage hero banner carousel images on the storefront homepage."
      icon={ImageAttachIcon}
      backHref="/admin/settings"
      backLabel="Settings"
    >
      <HomepageSliderSettingsPanel />
    </AdminPageLayout>
  );
}
