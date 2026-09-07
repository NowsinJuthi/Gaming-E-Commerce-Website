import { ContactEmailForm } from "@/components/contact/ContactEmailForm";
import { CONTACT_EMAIL_CARD_SURFACE_CLASS } from "@/components/contact/contact-email-card";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";

export default function EmailSupportPage() {
  return (
    <CustomerPageLayout
      section=""
      iconKey="email_support"
      title="Email Support"
      description="Send us a detailed message and our team will reply by email."
      backHref="/dashboard"
      heroSurfaceClassName={CONTACT_EMAIL_CARD_SURFACE_CLASS}
    >
      <ContactEmailForm
        heading="Email Support"
        description="Fill out the form below for order help, account issues, or general questions."
      />
    </CustomerPageLayout>
  );
}
