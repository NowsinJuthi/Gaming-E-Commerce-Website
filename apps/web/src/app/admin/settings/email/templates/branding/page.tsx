"use client";

import { EmailBrandingPanel } from "@/components/admin/email/EmailBrandingPanel";
import { EmailSettingsNav } from "@/components/admin/email/EmailSettingsNav";
import { EmailSetupGuide } from "@/components/admin/email/EmailSetupGuide";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderPageIntro,
  EMAIL_QUICK_LINKS,
  SETTINGS_QUICK_LINKS,
} from "@/components/admin/admin-order-page-shell";
import { MailIcon } from "@/components/admin/icons";

export default function EmailBrandingPage() {
  return (
    <AdminPageLayout section="Settings" icon={MailIcon}>
      <AdminOrderPageIntro
        icon={<MailIcon className="h-4 w-4" />}
        title="Email header logo"
        subtitle="Header logo, footer text, and accent color for every transactional email template."
        quickLinks={[...SETTINGS_QUICK_LINKS.slice(0, 3), ...EMAIL_QUICK_LINKS]}
        quickNavLabel="Settings shortcuts"
      />

      <div className="admin-email-branding-page space-y-5">
        <AdminOrderListCard
          icon={<MailIcon className="h-4 w-4" />}
          title="Email sections"
          subtitle="Navigate between SMTP, templates, and branding."
          className="admin-email-catalog"
        >
          <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
            <dt>Sections</dt>
            <dd>
              <EmailSettingsNav />
            </dd>
          </div>
        </AdminOrderListCard>

        <EmailBrandingPanel />

        <EmailSetupGuide />
      </div>
    </AdminPageLayout>
  );
}
