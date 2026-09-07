import Link from "next/link";
import { CONTACT_EMAIL_CARD_CLASS, CONTACT_EMAIL_CARD_SURFACE_CLASS } from "@/components/contact/contact-email-card";
import { ContactEmailForm } from "@/components/contact/ContactEmailForm";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";

export default function SupportPage() {
  return (
    <CustomerPageLayout
      section=""
      iconKey="support"
      title="Support"
      description="Get help via live chat, support tickets, or email"
      backHref="/dashboard"
      heroSurfaceClassName={CONTACT_EMAIL_CARD_SURFACE_CLASS}
    >
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <ContactEmailForm
          id="support-email-form"
          className="flex h-full min-w-0 flex-col"
          heading="Email Support"
          description="Send us a detailed message by email if live chat or tickets are not convenient."
          headingId="support-email-form-title"
        />

        <section
          className={`${CONTACT_EMAIL_CARD_CLASS} flex h-full min-w-0 flex-col`}
        >
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Get help
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            Chat with our team or open a support ticket for quick help.
          </p>

          <div className="mt-6 grid gap-3">
            <Link
              href="/chat"
              className="admin-input block cursor-pointer p-4 transition hover:border-brand/40"
            >
              <p className="font-semibold text-foreground">Live chat</p>
              <p className="mt-1.5 text-sm text-foreground-muted">
                Chat with our team in real time for quick questions.
              </p>
              <span className="mt-3 inline-block text-sm font-semibold text-brand">
                Open chat →
              </span>
            </Link>

            <Link
              href="/tickets"
              className="admin-input block cursor-pointer p-4 transition hover:border-brand/40"
            >
              <p className="font-semibold text-foreground">Support tickets</p>
              <p className="mt-1.5 text-sm text-foreground-muted">
                Create a ticket for order issues, refunds, or account help.
              </p>
              <span className="mt-3 inline-block text-sm font-semibold text-brand">
                View tickets →
              </span>
            </Link>
          </div>
        </section>
      </div>
    </CustomerPageLayout>
  );
}
