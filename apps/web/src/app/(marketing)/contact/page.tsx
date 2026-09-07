import type { Metadata } from "next";
import { HOME_PAGE_BG } from "@/components/home/home-container";
import { ContactHeroPanel } from "@/components/contact/ContactHeroPanel";
import {
  LiveChatCard,
  WhatsAppCard,
} from "@/components/contact/ContactSupportActions";
import { getContactPageSettings, type ContactSettings } from "@/lib/api";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/contact", seo);
}

const FALLBACK: ContactSettings = {
  heading: "Keep In Touch With Us.",
  subheading: "",
  extraText: "",
  address: { label: "Office Address", lines: [] },
  support: { label: "Phone Support", phones: [] },
  email: { label: "Email Address", emails: [] },
  social: { label: "Social", facebookUrl: "", youtubeUrl: "", whatsappUrl: "", links: [] },
};

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-3.58 8-10V5l-8-3-8 3v7c0 6.42 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function InfoCard({
  icon,
  label,
  children,
  iconTone = "brand",
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  iconTone?: "brand" | "muted";
}) {
  const tone =
    iconTone === "muted" ? "contact-info-icon-muted" : "bg-brand/15 text-brand";
  return (
    <div className="contact-option-card flex items-center gap-4 rounded-2xl border border-border/60 bg-elevated px-3 py-4 shadow-card transition hover:border-brand/30 sm:px-5 sm:py-5">
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">
          {label}
        </p>
        <div className="mt-0.5 space-y-0.5 text-[15px] font-semibold text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function ContactPage() {
  const seo = await getCachedSeoConfig();
  let data: ContactSettings = FALLBACK;
  try {
    data = await getContactPageSettings();
  } catch {
    /* use fallback */
  }

  const hasAddress = data.address.lines.length > 0;
  const hasSupport = data.support.phones.length > 0;
  const hasEmail = data.email.emails.length > 0;

  return (
    <main className={`contact-page min-h-screen ${HOME_PAGE_BG}`}>
      <div className="contact-page-shell mx-auto w-full max-w-[1600px] min-w-0 px-1.5 py-8 sm:px-4 sm:py-10 md:px-5 lg:px-6">
        <ContactHeroPanel data={data} seo={seo} />

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <LiveChatCard />

          <div className="flex flex-col gap-4">
            {hasSupport ? (
              <InfoCard
                icon={<PhoneIcon className="h-5 w-5" />}
                label={data.support.label || "Phone Support"}
                iconTone="muted"
              >
                {data.support.phones.map((phone, i) => (
                  <a
                    key={i}
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="block transition hover:text-brand"
                  >
                    {phone}
                  </a>
                ))}
              </InfoCard>
            ) : null}

            {hasEmail ? (
              <InfoCard
                icon={<MailIcon className="h-5 w-5" />}
                label={data.email.label || "Email Address"}
              >
                {data.email.emails.map((addr, i) => (
                  <a
                    key={i}
                    href={`mailto:${addr}`}
                    className="block break-all transition hover:text-brand"
                  >
                    {addr}
                  </a>
                ))}
              </InfoCard>
            ) : null}

            {hasAddress ? (
              <InfoCard
                icon={<PinIcon className="h-5 w-5" />}
                label={data.address.label || "Office Address"}
                iconTone="muted"
              >
                {data.address.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </InfoCard>
            ) : null}

            <WhatsAppCard
              whatsappUrl={data.social.whatsappUrl}
              title={data.whatsappCard?.title}
              description={data.whatsappCard?.description}
            />

            <div className="contact-option-card rounded-2xl border border-border/60 bg-elevated px-3 py-5 text-center shadow-card sm:px-6 sm:py-7">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <ShieldIcon className="h-9 w-9" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">
                100% Secure &amp; Reliable
              </h3>
              <p className="mt-1.5 text-sm text-foreground-muted">
                Your message is processed securely. We guarantee strict
                confidentiality for all support conversations.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
