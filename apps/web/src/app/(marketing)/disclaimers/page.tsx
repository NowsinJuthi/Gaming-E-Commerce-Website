import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import {
  DisclaimersHeroArt,
  DisclaimersIcon,
  type DisclaimersIconVariant,
} from "@/components/marketing/DisclaimersIcons";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

const SUPPORT_EMAIL = "support@uniqbd.com";
const SITE_URL = "https://uniqbd.com";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/disclaimers/", seo);
}

type PolicySection = {
  id: string;
  title: string;
  icon: DisclaimersIconVariant;
  paragraphs: string[];
  bullets?: string[];
  highlight?: React.ReactNode;
  delayMs?: number;
};

const SECTIONS: PolicySection[] = [
  {
    id: "introduction",
    title: "Disclaimers for UniQbd",
    icon: "intro",
    delayMs: 0,
    paragraphs: [
      `If you need any more information about our UniQbd site disclaimer or have any questions, please feel free to contact us at ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    id: "general",
    title: "General disclaimer",
    icon: "general",
    delayMs: 80,
    paragraphs: [
      `All the information on this website — ${SITE_URL} — is published in good faith and for general information purposes only. UniQbd does not make any warranties about the completeness, reliability, and accuracy of this information. Any action you take upon the information you find on this website (UniQbd) is strictly at your own risk. UniQbd will not be liable for any losses and/or damages in connection with the use of our website.`,
    ],
  },
  {
    id: "external-links",
    title: "External websites",
    icon: "external",
    delayMs: 160,
    paragraphs: [
      "From our website, you can visit other websites by following hyperlinks to similar external sites we provide. While we strive to provide only quality links to appropriate and ethical websites for our visitors, we have no control over the content and nature of these sites. These links to other websites do not imply a recommendation for all the content found on these sites. Site owners and content may change without notice and may occur before we have the opportunity to remove a link that may have gone bad.",
      "Please also be aware that when you leave our website, other sites may have different privacy policies and terms that are not under our control. Please be sure to check the Privacy Policies of these sites as well as their Terms of Service before engaging in any business or uploading any information on other sites.",
    ],
    highlight: (
      <>
        See also:{" "}
        <Link href="/privacy-policy">Privacy Policy</Link>
        {" · "}
        <Link href="/terms-conditions">Terms &amp; Conditions</Link>
      </>
    ),
  },
  {
    id: "gift-card",
    title: "Disclaimer: UniQbd Gift Card",
    icon: "gift",
    delayMs: 240,
    paragraphs: [
      "Each gift card must be redeemed in a single transaction by purchasing any service.",
      "If the value of the transaction exceeds the value of the gift card, then the value of such gift card will be credited to the account as store credit.",
      "If the value of the transaction exceeds the value of the gift card, you will need to cover the deficit through such methods of payment with the store credit available in the account.",
      "Gift cards have a set dollar value that is printed on the front of the card and cannot be used to purchase other gift cards.",
      "Not every gift card is transferable. Cash cannot be paid out.",
      "UniQbd will not be liable for any gift cards stolen, misplaced, or misused without authorization. To avoid suspicion, UniQbd Gift Card will not be required to search or verify during redemption if such a gift card is properly received.",
      "UniQbd will not be liable for any loss or damage to the gift card and the holder of the gift card will not be liable for any loss or damage related to the loss or damage of the gift card.",
      "In spite of the above, if there is any doubt about the authenticity of any gift card from UniQbd, then UniQbd has no choice but to suspend or cancel such gift card without prior notice. UniQbd retains all rights in such cases.",
      "UniQbd reserves the right to disable or void the gift card if it is fraudulently obtained or used in any way to pay for unauthorized services not approved by UniQbd.",
      "Each gift card is subject to further rules, disclaimers and regulations that UniQbd may introduce at any time or from time to time.",
      "Each gift card will automatically expire, without prior notice from UniQbd, on the last day of the second (2nd) year from the day that gift card was first purchased or another period that UniQbd may set.",
    ],
  },
  {
    id: "direct-topup",
    title: "Direct Top Up",
    icon: "topup",
    delayMs: 320,
    paragraphs: [
      "Please read the full product description and make sure the game name, server, account name, account number, and purchase amount are correct.",
      "Fill everything correctly. Note: If you make a mistake and we deliver the product to others, it may not be refundable — so type the information correctly and slowly.",
      "Pay in the correct account provided by us. If the customer makes a mistake in the payment and if any customer gives us the wrong transaction number, we will not be able to deliver the product.",
      "All important phrases are highlighted for UniQbd customers so that they can easily order.",
      "If you encounter any difficulties, please contact our 24/7 Live Support for further assistance.",
    ],
  },
  {
    id: "consent",
    title: "Consent",
    icon: "consent",
    delayMs: 400,
    paragraphs: [
      "By using our UniQbd website, you hereby agree to our disclaimer and agree to its terms.",
    ],
  },
  {
    id: "update",
    title: "Update",
    icon: "update",
    delayMs: 480,
    paragraphs: [
      "Should we update, amend or make any changes to this document, those changes will be prominently posted here.",
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
        <DisclaimersIcon variant={section.icon} />
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

      {section.highlight ? (
        <div className="refund-policy-highlight">{section.highlight}</div>
      ) : null}
    </article>
  );
}

export default function DisclaimersPage() {
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
                Disclaimers
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-foreground-muted">
                Important notices about using UniQbd — website information, gift
                cards, direct top-ups, and your agreement to these terms.
              </p>
            </div>
            <DisclaimersHeroArt className="md:mr-2" />
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
              <DisclaimersIcon variant="contact" size="lg" />
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
              for questions related to refunds, returns, or disclaimers.
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
