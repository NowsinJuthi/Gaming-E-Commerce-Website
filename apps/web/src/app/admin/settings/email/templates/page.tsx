"use client";

import { EmailTemplateLibrary } from "@/components/admin/email/EmailTemplateLibrary";
import { EmailSetupGuide } from "@/components/admin/email/EmailSetupGuide";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { MailIcon } from "@/components/admin/icons";

export default function EmailTemplatesPage() {
  return (
    <AdminPageLayout section="Settings" icon={MailIcon}>
      <div className="admin-email-templates-page space-y-5">
        <EmailTemplateLibrary showBranding={false} showNav />
        <EmailSetupGuide />
      </div>
    </AdminPageLayout>
  );
}
