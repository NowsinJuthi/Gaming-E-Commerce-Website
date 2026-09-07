import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import {
  TermsHeroArt,
  TermsIcon,
  type TermsIconVariant,
} from "@/components/marketing/TermsConditionsIcons";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

const SUPPORT_EMAIL = "support@uniqbd.com";
const SITE_URL = "https://uniqbd.com";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/terms-conditions/", seo);
}

type PolicySection = {
  id: string;
  title: string;
  icon: TermsIconVariant;
  paragraphs: string[];
  bullets?: string[];
  highlight?: React.ReactNode;
  delayMs?: number;
};

const SECTIONS: PolicySection[] = [
  {
    id: "introduction",
    title: "Introduction",
    icon: "intro",
    delayMs: 0,
    paragraphs: [
      "Welcome to UniQbd!",
      `These Terms of Service govern your use of our website at ${SITE_URL} operated by UniQbd.`,
      "Our Privacy Policy also regulates your use of our Services and explains how we collect, protect and disclose information as a result of your use of our web pages.",
      "Your agreement with us includes these terms and our Privacy Policy. You acknowledge that you have read and understood the agreements and agree to abide by them.",
      `If you do not agree with the Agreement, you may not use the Service, but please email us at ${SUPPORT_EMAIL} so that we can try to find a solution. These Terms apply to all visitors, users, and others who wish to access or use the Services.`,
    ],
  },
  {
    id: "communications",
    title: "Communications",
    icon: "mail",
    delayMs: 80,
    paragraphs: [
      "By using our website, you agree to subscribe to newsletters, marketing or promotional materials, and other data we may send.",
      `However, you can opt out of receiving all these contacts from us by following the unsubscribe link or by emailing ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    id: "purchases",
    title: "Purchases",
    icon: "cart",
    delayMs: 160,
    paragraphs: [
      "However, you may be asked to give some data applicable to your purchase, including your credit or debit card number, if you wish to buy any product or service available through the Service.",
      "You represent and warrant that:",
    ],
    bullets: [
      "You have the legal right to use any card(s) or other forms of payment for any purchase; and",
      "The data you give to us is correct, accurate, and complete.",
    ],
    highlight: (
      <>
        We may use third-party services to process payment and completion of
        purchases. By submitting your data, you grant this third party the right
        to disclose data subject to our privacy policy. We reserve the right to
        reject or cancel your order at any time for reasons including but not
        limited to product availability, description or price errors, order
        errors, or other reasons. We have the right to decline or cancel your
        order if we suspect fraud or unauthorized or illegal transactions.
      </>
    ),
  },
  {
    id: "contests",
    title: "Contests, Sweepstakes, and Promotions",
    icon: "trophy",
    delayMs: 240,
    paragraphs: [
      "Any contests, sweepstakes, or other promotions provided by the Services may be governed by separate terms from these Terms of Service.",
      "If you participate in any campaigns, please review our Privacy Policy as well as the applicable rules. If the Terms of Service conflict with promotion-specific terms, the Terms of Promotion will apply.",
    ],
  },
  {
    id: "subscriptions",
    title: "Subscriptions",
    icon: "subscription",
    delayMs: 320,
    paragraphs: [
      'Some parts of the Service are billed on a subscription basis ("Subscription(s)"). You\'ll be billed in advance on a recurring and periodic basis ("Billing Cycle"). Billing cycles will be set depending on the type of subscription plan you select when purchasing a Subscription.',
      "At the end of each Billing Cycle, your Subscription will automatically renew under the same conditions unless you cancel it or UniQbd cancels it. You may cancel your Subscription renewal either through your online account management portal or by contacting our client support team.",
      "A valid payment method is needed to process the payment for your subscription. You shall provide UniQbd with accurate and complete billing information that may include but isn't limited to full name, address, state, postal or zip code, telephone number, and valid payment method information. By submitting such payment data, you automatically authorize UniQbd to charge all Subscription charges incurred through your account to any such payment methods.",
      "Should automatic billing fail for any reason, UniQbd reserves the right to terminate your access to the Service with immediate effect.",
    ],
    highlight: (
      <>
        Cancel subscriptions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </>
    ),
  },
  {
    id: "free-trial",
    title: "Free Trial",
    icon: "trial",
    delayMs: 400,
    paragraphs: [
      'UniQbd may, at its sole discretion, offer a Subscription with a free trial for a limited period of time ("Free Trial"). You may be required to provide your correct billing data in order to sign up for a Free Trial.',
      "If you do enter your billing information when signing up for a Free Trial, you will not be charged by UniQbd until the Free Trial has expired.",
      "On the final day of the Free Trial period, unless you canceled your Subscription, you will be automatically charged the applicable Subscription fees for the type of Subscription you have selected. We provide a free trial for real buyers only.",
      "At any time and without notice, UniQbd reserves the right to (i) modify Terms of Service of the Free Trial offer, or (ii) cancel such Free Trial offer.",
    ],
  },
  {
    id: "fee-changes",
    title: "Fee Changes",
    icon: "fees",
    delayMs: 480,
    paragraphs: [
      "Any Subscription charge change will be effective at the end of the then-current Billing Cycle.",
      "UniQbd will provide you with reasonable prior notice of any change in Subscription fees to give you an opportunity to terminate your Subscription before such change becomes effective.",
      "Your continued use of the Service after the Subscription charge change comes into effect constitutes your agreement to pay the modified Subscription charge amount.",
    ],
  },
  {
    id: "refunds",
    title: "Refunds",
    icon: "refund",
    delayMs: 560,
    paragraphs: [
      "We issue refunds for Contracts within 30 days of the original purchase of the Contract.",
    ],
  },
  {
    id: "content",
    title: "Content",
    icon: "content",
    delayMs: 640,
    paragraphs: [
      "The content found on or through this Service is the property of UniQbd or used with authorization. You may not distribute, modify, transmit, exercise, download, repost, copy, or use said Content, whether in whole or in part, for commercial purposes or for personal gain, without express advance written authorization from us.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: "analytics",
    delayMs: 720,
    paragraphs: [
      "We may use third-party Service Providers to monitor and analyze the use of our Service.",
    ],
  },
  {
    id: "minors",
    title: "No Use By Minors",
    icon: "shield",
    delayMs: 800,
    paragraphs: [
      "The Service is intended for access and use only by persons aged at least eighteen (18) years. By accessing or using the Services, you warrant and represent that you're at least eighteen (18) years of age and with full authority, rights and powers to enter into this Agreement and to comply with all terms and conditions.",
      "Unless you're at least 18 years old, you're prohibited from accessing and using the Services.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts",
    icon: "account",
    delayMs: 880,
    paragraphs: [
      "When you create an account with us, you guarantee that you are over 18 years of age and that the information you provide us is always accurate, complete and current. Incorrect, deficient or obsolete information may result in immediate termination of your account with the Service.",
      "You are responsible for maintaining the confidentiality of your account and password, including but not limited to access to your computer and/or account. You agree to accept responsibility for any and all actions that take place under your account and/or password, whether your password is with our Services or third-party services. You must notify us as soon as you become aware of security breaches or unauthorized use of your account.",
      "You may not use the name of another person or entity as a username or which is not legally available for use, a name or trademark which is subject to the rights of any person or entity other than you, without proper authorization. You may not use an offensive, obscene, or inappropriate name as a username.",
      "We reserve the right to refuse services, close accounts, remove or edit content or cancel orders at our own discretion.",
    ],
  },
  {
    id: "feedback",
    title: "Error Reporting and Feedback",
    icon: "feedback",
    delayMs: 960,
    paragraphs: [
      `You can provide us with information and feedback ("Feedback") directly at ${SUPPORT_EMAIL} or through third-party sites and tools, with suggestions for improvements, ideas, problems, complaints and other issues related to our Services. You acknowledge and agree that:`,
    ],
    bullets: [
      "You will not retain, acquire or claim any intellectual property rights or other rights, title or interest in response or support;",
      "The company may create similar concepts of feedback;",
      "The response does not contain confidential information or proprietary information from you or any third party; and",
      "The company is not subject to any confidentiality obligation in the response.",
    ],
    highlight: (
      <>
        If you are unable to transfer ownership of Feedback due to applicable
        binding law, you grant the Company and its affiliates an exclusive,
        transferable, irrevocable, free, sub-licensed, unlimited and permanent
        use right to Feedback in any way and for any purpose (including copying,
        modifying, creating, publishing, distributing and commercializing
        derivative works).
      </>
    ),
  },
  {
    id: "warranty",
    title: "Disclaimer Of Warranty",
    icon: "warranty",
    delayMs: 1040,
    paragraphs: [
      'These services are provided by the company on an "as is" and "as available" basis. The Company does not provide any representations or warranties of any kind, express or implied, for the conduct of their services, or the information, content, or materials contained therein. You expressly agree that your use of these Services, their Content and any Services or items obtained from us is at your sole risk.',
      "The Company or any person affiliated with the Company makes no warranties or representations regarding integrity, security, reliability, quality, accuracy, or availability. Without limiting the aforesaid matters, the Company does not represent or warrant that errors will be corrected, that the services or servers that make them available will be free from viruses or other malicious elements, or that services will meet your requirements.",
      "The Company hereby disclaims all guarantees of any kind, whether express or implied, statutory or otherwise, including but not limited to any guarantees of merchantability.",
      "The aforesaid does not affect any warranty which may not be waived or limited under applicable law.",
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    icon: "contact",
    delayMs: 1120,
    paragraphs: [
      `Please send your feedback, comments, and requests for technical support by email: ${SUPPORT_EMAIL}.`,
    ],
    highlight: (
      <>
        Email:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </>
    ),
  },
];

function PolicyCard({ section }: { section: PolicySection }) {
  return (
    <article
      className="refund-policy-card"
      style={{ animationDelay: `${(section.delayMs ?? 0) / 1000}s` }}
    >
      <div className="refund-policy-card__head">
        <TermsIcon variant={section.icon} />
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

export default function TermsConditionsPage() {
  return (
    <main className="refund-policy-page min-h-screen bg-surface text-foreground">
      <div className="refund-policy-page-shell mx-auto w-full max-w-[1600px] min-w-0 px-1.5 py-8 sm:px-4 sm:py-10 md:px-5 lg:px-6">
        <section className="refund-policy-hero relative overflow-hidden rounded-2xl border border-border/60 bg-elevated shadow-card">
          <MarketingHeroBubbles />
          <div className="relative z-10 flex flex-col gap-8 px-3 py-8 sm:px-10 sm:py-12 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="dashboard-pro-status dashboard-pro-status--brand inline-flex px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]">
                Legal
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-[2.6rem]">
                Terms &amp; Conditions
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-foreground-muted">
                The rules and guidelines for using UniQbd — purchases,
                subscriptions, accounts, content, and how to reach our support
                team.
              </p>
            </div>
            <TermsHeroArt className="md:mr-2" />
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
              <TermsIcon variant="contact" size="lg" />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Questions about our terms?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted sm:text-base">
              Contact us at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              for clarification on any section of these Terms &amp; Conditions.
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
