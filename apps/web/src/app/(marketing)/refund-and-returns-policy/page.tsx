import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import {
  RefundPolicyHeroArt,
  RefundPolicyIcon,
  type RefundPolicyIconVariant,
} from "@/components/marketing/RefundPolicyIcons";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

const SUPPORT_EMAIL = "support@uniqbd.com";
const RETURN_ADDRESS =
  "Rajabari, Turag, Dhaka — House 13, Road 01, Block B, Ward 54, Dhaka 1711";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/refund-and-returns-policy/", seo);
}

type PolicySection = {
  id: string;
  title: string;
  icon: RefundPolicyIconVariant;
  paragraphs: string[];
  steps?: string[];
  highlight?: React.ReactNode;
  delayMs?: number;
};

const SECTIONS: PolicySection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: "overview",
    delayMs: 0,
    paragraphs: [
      "Once your return is received and audited, we will send you an email to notify you that we have received your returned item. We will also notify you of the approval or rejection of your refund.",
      "If you are approved, your refund will be issued and a credit will automatically be applied to your credit card or original method of payment.",
    ],
  },
  {
    id: "refunds",
    title: "Refunds",
    icon: "refund",
    delayMs: 80,
    paragraphs: [
      "Once your return is received and audited, we will send you an email to notify you that we have received your returned item. We will also notify you of the approval or rejection of your refund.",
      "If you are approved, your refund will be issued and a credit will automatically be applied to your credit card or original method of payment.",
    ],
  },
  {
    id: "late-refunds",
    title: "Late or missing refunds",
    icon: "clock",
    delayMs: 160,
    paragraphs: [
      "If you have not received a refund yet, please follow the steps below before contacting us.",
    ],
    steps: [
      "First, check your bank account again.",
      "Next, contact your bank — there is often some processing time before a refund is posted.",
      `If you have done all of this and still have not received your refund, please contact us at ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    id: "sale-items",
    title: "Sale items",
    icon: "sale",
    delayMs: 240,
    paragraphs: [
      "Only regular-priced items may be refunded. Sale items cannot be refunded.",
    ],
  },
  {
    id: "late-returns",
    title: "Late or missing returns",
    icon: "clock",
    delayMs: 320,
    paragraphs: [
      "If you have not received confirmation for your return yet, please follow the steps below.",
    ],
    steps: [
      "First, check your bank account or payment statement again.",
      "Next, contact your bank — processing time may apply before a refund is posted.",
      `If you still need help, please contact us at ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    id: "exchanges",
    title: "Exchanges",
    icon: "exchange",
    delayMs: 400,
    paragraphs: [
      "We only replace products if they are damaged or if the same product was delivered two or more times.",
      "If you want to exchange the same item, send us an email and return your item to the address below.",
    ],
    highlight: (
      <>
        Email:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <span className="refund-policy-address">{RETURN_ADDRESS}</span>
      </>
    ),
  },
  {
    id: "gifts",
    title: "Gifts",
    icon: "gift",
    delayMs: 480,
    paragraphs: [
      "If the item was marked as a gift when purchased and shipped directly to you, you will receive a gift credit for your return amount. Upon receipt of the returned item, a gift certificate will be mailed to you.",
      "If the product was not marked as a gift at the time of purchase, or the giver later had the order shipped to you, we will return it to the giver and they will be informed about your return.",
    ],
  },
  {
    id: "shipping-returns",
    title: "Shipping returns",
    icon: "shipping",
    delayMs: 560,
    paragraphs: [
      "For shipping-related return issues, the same refund timelines and bank processing rules apply.",
      "Only regular-priced items may be refunded. Trade or promotional sale items cannot be refunded.",
      "If the product was not marked as a gift at the time of purchase, or the giver later had the order shipped to you, we will return it to the giver and they will be informed about your return.",
    ],
    steps: [
      "First, check your bank account again if you have not received a refund yet.",
      "Next, contact your bank — there is usually processing time before a refund appears.",
      `If you have done all of this and still have not received your refund, contact us at ${SUPPORT_EMAIL}.`,
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
        <RefundPolicyIcon variant={section.icon} />
        <h2 className="refund-policy-card__title">{section.title}</h2>
      </div>

      <div className="refund-policy-card__body">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

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

export default function RefundAndReturnsPolicyPage() {
  return (
    <main className="refund-policy-page min-h-screen bg-surface text-foreground">
      <div className="refund-policy-page-shell mx-auto w-full max-w-[1600px] min-w-0 px-1.5 py-8 sm:px-4 sm:py-10 md:px-5 lg:px-6">
        <section className="refund-policy-hero relative overflow-hidden rounded-2xl border border-border/60 bg-elevated shadow-card">
          <MarketingHeroBubbles />
          <div className="relative z-10 flex flex-col gap-8 px-3 py-8 sm:px-10 sm:py-12 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="dashboard-pro-status dashboard-pro-status--brand inline-flex px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]">
                Customer policy
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-[2.6rem]">
                Refund And Returns Policy
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-foreground-muted">
                Everything you need to know about refunds, returns, exchanges,
                gifts, and shipping — clear steps and support contacts in one
                place.
              </p>
            </div>
            <RefundPolicyHeroArt className="md:mr-2" />
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
              <RefundPolicyIcon variant="help" size="lg" />
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
              for any questions about refunds, returns, or exchanges.
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
