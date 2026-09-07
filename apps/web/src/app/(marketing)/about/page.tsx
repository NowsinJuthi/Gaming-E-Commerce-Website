import type { Metadata } from "next";
import Link from "next/link";
import {
  AboutBeliefIcon,
  AboutCtaIcon,
  AboutFeatureIcon,
  AboutOfferingIcon,
  AboutSectionBadgeIcon,
  AboutStepIcon,
  type AboutIconVariant,
} from "@/components/marketing/AboutAnimatedIcons";
import { AboutIntroPanel } from "@/components/marketing/AboutIntroPanel";
import { getCachedContactPageSettings, getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/about", seo);
}

const HIGHLIGHTS: {
  title: string;
  description: string;
  icon: AboutIconVariant;
}[] = [
  {
    title: "Instant delivery",
    description:
      "Most digital products are fulfilled automatically after payment — codes and top-ups reach you in minutes, not days.",
    icon: "bolt",
  },
  {
    title: "Secure payments",
    description:
      "Pay with wallet balance, bKash, Nagad, or other trusted gateways. Every transaction is verified before your order is processed.",
    icon: "shield",
  },
  {
    title: "Wide catalog",
    description:
      "From gaming top-ups and gift cards to subscriptions and digital goods — browse categories curated for gamers and everyday shoppers.",
    icon: "catalog",
  },
  {
    title: "Real support",
    description:
      "Questions before or after purchase? Reach our team through live chat, tickets, and email — we are here when you need us.",
    icon: "chat",
  },
];

const OFFERINGS: {
  title: string;
  body: string;
  icon: AboutIconVariant;
}[] = [
  {
    title: "Gaming top-ups",
    body: "Recharge your favourite games quickly with region-aware products and transparent pricing in BDT.",
    icon: "gamepad",
  },
  {
    title: "Gift cards & vouchers",
    body: "Digital gift cards for streaming, apps, and entertainment — ready to redeem after checkout.",
    icon: "gift",
  },
  {
    title: "Customer wallet",
    body: "Add balance once and pay faster on repeat orders. Track spending from your personal dashboard.",
    icon: "wallet",
  },
  {
    title: "Order tracking",
    body: "View order history, download delivered codes, and manage your account from one secure place.",
    icon: "track",
  },
];

const STEPS: {
  step: string;
  title: string;
  body: string;
  icon: AboutIconVariant;
}[] = [
  {
    step: "01",
    title: "Browse & choose",
    body: "Explore products by category, compare options, and add items to your cart in a few clicks.",
    icon: "browse",
  },
  {
    step: "02",
    title: "Pay securely",
    body: "Complete checkout with wallet, mobile banking, or other supported payment methods.",
    icon: "pay",
  },
  {
    step: "03",
    title: "Receive instantly",
    body: "Get your digital goods delivered to your account and email as soon as payment is confirmed.",
    icon: "receive",
  },
];

const BELIEFS = [
  "Transparency in pricing — what you see is what you pay.",
  "Security first — verified payments and protected accounts.",
  "Speed matters — digital products should arrive without delay.",
  "Support with care — real people when automation is not enough.",
] as const;

function SectionBadge({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span className="dashboard-pro-status dashboard-pro-status--brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]">
      {icon}
      {children}
    </span>
  );
}

function SectionHeading({
  badge,
  badgeIcon,
  title,
  subtitle,
  centered = false,
}: {
  badge: string;
  badgeIcon?: AboutIconVariant;
  title: string;
  subtitle?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "text-center" : ""}>
      <SectionBadge
        icon={
          badgeIcon ? <AboutSectionBadgeIcon variant={badgeIcon} /> : undefined
        }
      >
        {badge}
      </SectionBadge>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mt-3 text-sm leading-relaxed text-foreground-muted sm:text-base${
            centered ? " mx-auto max-w-2xl" : " max-w-2xl"
          }`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: AboutIconVariant;
}) {
  return (
    <div className="about-option-card flex h-full flex-col rounded-2xl border border-border/60 bg-elevated px-3 py-4 shadow-card transition hover:border-brand/30 sm:px-5 sm:py-5">
      <AboutFeatureIcon variant={icon} />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        {description}
      </p>
    </div>
  );
}

export default async function AboutPage() {
  const [contact, seo] = await Promise.all([
    getCachedContactPageSettings(),
    getCachedSeoConfig(),
  ]);

  return (
    <main className="about-page min-h-screen bg-surface text-foreground">
      <div className="about-page-shell mx-auto w-full max-w-[1600px] min-w-0 px-1.5 py-8 sm:px-4 sm:py-10 md:px-5 lg:px-6">
        <AboutIntroPanel contact={contact} seo={seo} />

        {/* Story + beliefs */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="about-option-card rounded-2xl border border-border/60 bg-elevated p-4 shadow-card sm:p-8">
            <SectionHeading
              badge="Our story"
              badgeIcon="story"
              title="Shopping digital goods should feel effortless"
            />
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground-muted sm:text-[15px]">
              <p>
                UniQbd started with a clear goal: remove the friction from buying
                digital products in Bangladesh. No confusing checkout, no long
                waits, and no uncertainty about whether your payment went
                through.
              </p>
              <p>
                We combine a modern storefront, automated delivery, and human
                support so you can focus on what you purchased — whether that is
                topping up a game, sending a gift card, or stocking your wallet
                for the next order.
              </p>
              <p>
                Every part of the experience — from browsing categories to
                tracking orders in your dashboard — is designed to be clear,
                fast, and trustworthy.
              </p>
            </div>
          </div>

          <div className="about-option-card rounded-2xl border border-border/60 bg-elevated px-3 py-5 shadow-card sm:px-7">
            <SectionHeading
              badge="What we believe"
              badgeIcon="belief"
              title="Built on trust"
            />
            <ul className="mt-5 space-y-4">
              {BELIEFS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-relaxed text-foreground-muted sm:text-[15px]"
                >
                  <AboutBeliefIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Highlights */}
        <section className="about-option-card mt-8 rounded-2xl border border-border/60 bg-elevated p-4 shadow-card sm:p-8">
          <SectionHeading
            badge="Why customers choose us"
            badgeIcon="star"
            title="Built for speed, security, and scale"
            centered
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {HIGHLIGHTS.map((item) => (
              <FeatureCard key={item.title} {...item} />
            ))}
          </div>
        </section>

        {/* Offerings */}
        <section className="about-option-card mt-8 rounded-2xl border border-border/60 bg-elevated p-4 shadow-card sm:p-8">
          <SectionHeading
            badge="What we offer"
            badgeIcon="grid"
            title="Everything you need in one place"
            subtitle="UniQbd is more than a shop — it is a complete platform for discovering, purchasing, and managing digital products."
            centered
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {OFFERINGS.map((item) => (
              <div
                key={item.title}
                className="about-option-card rounded-2xl border border-border/60 bg-surface px-3 py-4 transition hover:border-brand/30 sm:px-5 sm:py-5"
              >
                <AboutOfferingIcon variant={item.icon} />
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="about-option-card mt-8 rounded-2xl border border-border/60 bg-elevated p-4 shadow-card sm:p-8">
          <SectionHeading
            badge="How it works"
            badgeIcon="route"
            title="Three simple steps"
            centered
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((item) => (
              <div
                key={item.step}
                className="about-option-card rounded-2xl border border-border/60 bg-surface px-3 py-4 text-center sm:px-5 sm:py-5 sm:text-left"
              >
                <AboutStepIcon variant={item.icon} />
                <span className="mt-3 block text-xs font-bold uppercase tracking-[0.2em] text-brand/50">
                  Step {item.step}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="about-option-card mt-8 rounded-2xl border border-border/60 bg-elevated px-3 py-6 text-center shadow-card sm:px-10 sm:py-10">
          <div className="mx-auto flex w-fit justify-center">
            <AboutCtaIcon />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to shop smarter?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted sm:text-base">
            Join thousands of customers who rely on UniQbd for fast digital
            delivery, flexible payments, and responsive support.
          </p>
          <div className="about-cta-actions mt-8">
            <Link href="/products" className="btn-primary about-cta-btn">
              Start shopping
            </Link>
            <Link href="/register" className="btn-secondary about-cta-btn">
              Create account
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
