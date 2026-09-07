"use client";

import { CONTACT_EMAIL_CARD_SURFACE_CLASS } from "@/components/contact/contact-email-card";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { LiveSupportView } from "@/components/customer/LiveSupportView";

export default function UserChatPage() {
  return (
    <CustomerPageLayout
      section=""
      title="Live Support"
      description="Chat with our team in real time."
      iconKey="chat"
      backHref="/dashboard"
      backLabel="Dashboard"
      heroSurfaceClassName={CONTACT_EMAIL_CARD_SURFACE_CLASS}
    >
      <LiveSupportView />
    </CustomerPageLayout>
  );
}
