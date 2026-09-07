import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import {
  PrivacyHeroArt,
  PrivacyIcon,
  type PrivacyIconVariant,
} from "@/components/marketing/PrivacyPolicyIcons";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

const SUPPORT_EMAIL = "support@uniqbd.com";
const SITE_URL = "https://uniqbd.com";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/privacy-policy/", seo);
}

type PolicySection = {
  id: string;
  title: string;
  icon: PrivacyIconVariant;
  paragraphs: string[];
  bullets?: string[];
  steps?: string[];
  highlight?: React.ReactNode;
  delayMs?: number;
};

const SECTIONS: PolicySection[] = [
  {
    id: "introduction",
    title: "Privacy Policy for UniQbd",
    icon: "intro",
    delayMs: 0,
    paragraphs: [
      `At UniQbd, accessible from ${SITE_URL}, one of our main priorities is the privacy of our visitors. This Privacy Policy describes the types of data that is collected and recorded by UniQbd and how we use it.`,
      `If you have additional questions or need more information about our Privacy Policy, feel free to contact us at ${SUPPORT_EMAIL}.`,
      "This Policy applies only to our online activities and is valid for visitors to our website with respect to the information that they share and/or collect in UniQbd.",
    ],
  },
  {
    id: "consent",
    title: "Consent",
    icon: "consent",
    delayMs: 80,
    paragraphs: [
      "By using our website, you agree to our UniQbd Privacy Policy.",
    ],
  },
  {
    id: "information",
    title: "Information we collect",
    icon: "collect",
    delayMs: 160,
    paragraphs: [
      "The personal information that you are asked to provide, and the reasons why you are asked to provide it, will be made clear to you at the point we ask you to provide your personal data.",
      "If you contact us directly, we may receive additional information about you such as your name and email address.",
      "When you register for an Account, we may ask for your contact information, including items such as name, company name, address, email address, and telephone number.",
    ],
  },
  {
    id: "overview",
    title: "Overview",
    icon: "overview",
    delayMs: 240,
    paragraphs: [
      "Our refund and returns policy lasts 30 days. If 30 days have passed since your purchase, we can't offer you a full refund or exchange.",
      "To be eligible for a return or refund, your item must be unopened and unused and in the same condition that you received from us. It must also be in the original and unopened packaging.",
      "Several types of goods are exempt from being returned. Perishable goods such as food, flowers, newspapers, or magazines cannot be returned. We also do not accept products that are intimate or sanitary goods, hazardous materials, or flammable liquids or gases.",
      "To complete your return, we require a receipt or proof of purchase.",
      "There are situations where only partial returns are accepted.",
      "Any item that is returned more than 30 days after delivery.",
    ],
  },
  {
    id: "non-returnable",
    title: "Additional non-returnable items",
    icon: "excluded",
    delayMs: 320,
    paragraphs: ["The following items cannot be returned:"],
    bullets: ["Gift cards.", "Downloadable software products."],
  },
  {
    id: "refunds",
    title: "Refunds",
    icon: "refund",
    delayMs: 400,
    paragraphs: [
      "Once your return is received and inspected, we will send you an email to notify you that we have received your returned item. We will also notify you of the approval or rejection of your refund.",
      "If you are approved, then your refund will be processed, and a credit will automatically be applied to your credit card or original method of payment.",
    ],
  },
  {
    id: "late-refunds",
    title: "Late or missing refunds",
    icon: "clock",
    delayMs: 480,
    paragraphs: [
      "If you haven't received a refund yet, please follow the steps below.",
    ],
    steps: [
      "First, check your bank account again.",
      "Next, contact your bank. There is often some processing time before a refund is posted.",
      `If you have done all of this and still have not received your refund, please contact us at ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    id: "sale-items",
    title: "Sale items",
    icon: "sale",
    delayMs: 560,
    paragraphs: [
      "Only regular-priced items may be refunded. Sale items cannot be refunded.",
    ],
  },
  {
    id: "shipping-returns",
    title: "Shipping returns",
    icon: "shipping",
    delayMs: 640,
    paragraphs: [
      "For shipping-related return issues, the same refund timelines and bank processing rules apply.",
    ],
    steps: [
      "If you haven't received a refund yet, first check your bank account again.",
      "Next, contact your bank. There is often some processing time before a refund is posted.",
      `If you've done all of this and you still have not received your refund yet, please contact us at ${SUPPORT_EMAIL}.`,
    ],
  },
];

function PolicyCard({ section }: { section: PolicySection }) {
  return (
    <article
      className="refund-policy-card"
      style={{ animationDelay: `${(section.delayMs ?? 0) / 1000}s` }}
    >
      <div className="refund-policy-card__head">
        <PrivacyIcon variant={section.icon} />
        <h2 className="refund-policy-card__title">{section.title}</h2>
      </div>

      <div className="refund-policy-card__body">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {section.bullets?.length ? (
        <ul className="refund-policy-steps refund-policy-steps--bullets">
          {section.bullets.map((bullet, index) => (
            <li
              key={bullet}
              className="refund-policy-step refund-policy-step--bullet"
              style={{ animationDelay: `${0.12 + index * 0.08}s` }}
            >
              <span className="refund-policy-step__dot" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.steps?.length ? (
        <ol className="refund-policy-steps">
          {section.steps.map((step, index) => (
            <li
              key={step}
              className="refund-policy-step"
              style={{ animationDelay: `${0.12 + index * 0.08}s` }}
            >
              <span className="refund-policy-step__num">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {section.highlight ? (
        <div className="refund-policy-highlight">{section.highlight}</div>
      ) : null}
    </article>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="refund-policy-page min-h-screen bg-surface text-foreground">
      <div className={`${HOME_CONTAINER_CLS} py-8 sm:py-10`}>
        <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-elevated shadow-card">
          <MarketingHeroBubbles />
          <div className="relative z-10 flex flex-col gap-8 px-6 py-10 sm:px-10 sm:py-12 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="dashboard-pro-status dashboard-pro-status--brand inline-flex px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]">
                Legal
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-[2.6rem]">
                Privacy Policy
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-foreground-muted">
                How UniQbd collects, uses, and protects your information — plus
                related refund and returns guidance in one place.
              </p>
            </div>
            <PrivacyHeroArt className="md:mr-2" />
          </div>
        </section>

        <div className="refund-policy-sections">
          {SECTIONS.map((section) => (
            <PolicyCard key={section.id} section={section} />
          ))}
        </div>

        <section className="refund-policy-cta">
          <span className="refund-policy-cta__pulse" aria-hidden />
          <div className="relative z-10">
            <div className="mx-auto flex w-fit justify-center">
              <PrivacyIcon variant="contact" size="lg" />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Need help?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted sm:text-base">
              Contact us at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              for any questions about our Privacy Policy or your data.
            </p>
            <div className="about-cta-actions mt-8">
              <Link href="/chat" className="btn-primary about-cta-btn">
                Live chat
              </Link>
              <Link href="/support" className="btn-secondary about-cta-btn">
                Open support page
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
