import Link from "next/link";

import type { Route } from "next";

import type { WebsitePricingPackage } from "@/lib/website-page-settings";



type PackageIconVariant = "starter" | "business" | "enterprise" | "default";



function resolvePackageIconVariant(packageId: string): PackageIconVariant {

  const id = packageId.toLowerCase();

  if (id.includes("starter")) return "starter";

  if (id.includes("business")) return "business";

  if (id.includes("enterprise")) return "enterprise";

  return "default";

}



function StarterPackageIcon() {

  return (

    <svg viewBox="0 0 48 48" fill="none" className="website-pricing-card__icon-svg">

      <rect

        className="website-pricing-card__icon-starter-screen"

        x="11"

        y="14"

        width="26"

        height="18"

        rx="3"

        stroke="currentColor"

        strokeWidth="2.25"

      />

      <path

        className="website-pricing-card__icon-starter-base"

        d="M18 36h12M16 32h16"

        stroke="currentColor"

        strokeWidth="2.25"

        strokeLinecap="round"

      />

      <circle

        className="website-pricing-card__icon-starter-dot"

        cx="17"

        cy="20"

        r="1.5"

        fill="currentColor"

      />

      <path

        className="website-pricing-card__icon-starter-line"

        d="M21 26h12M21 22h8"

        stroke="currentColor"

        strokeWidth="2"

        strokeLinecap="round"

      />

      <path

        className="website-pricing-card__icon-starter-spark"

        d="M36 12l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2 1.2-2.4Z"

        fill="currentColor"

      />

    </svg>

  );

}



function BusinessPackageIcon() {

  return (

    <svg viewBox="0 0 48 48" fill="none" className="website-pricing-card__icon-svg">

      <rect

        className="website-pricing-card__icon-business-building"

        x="10"

        y="16"

        width="14"

        height="22"

        rx="2"

        stroke="currentColor"

        strokeWidth="2.25"

      />

      <path

        className="website-pricing-card__icon-business-window"

        d="M14 21h6M14 26h6M14 31h6"

        stroke="currentColor"

        strokeWidth="1.8"

        strokeLinecap="round"

      />

      <rect

        className="website-pricing-card__icon-business-bar website-pricing-card__icon-business-bar--1"

        x="28"

        y="28"

        width="5"

        height="10"

        rx="1.2"

        fill="currentColor"

      />

      <rect

        className="website-pricing-card__icon-business-bar website-pricing-card__icon-business-bar--2"

        x="35"

        y="22"

        width="5"

        height="16"

        rx="1.2"

        fill="currentColor"

      />

      <path

        className="website-pricing-card__icon-business-trend"

        d="M27 18l5-4 4 3 6-7"

        stroke="currentColor"

        strokeWidth="2.25"

        strokeLinecap="round"

        strokeLinejoin="round"

      />

      <circle

        className="website-pricing-card__icon-business-spark"

        cx="38"

        cy="11"

        r="2"

        fill="currentColor"

      />

    </svg>

  );

}



function EnterprisePackageIcon() {

  return (

    <svg viewBox="0 0 48 48" fill="none" className="website-pricing-card__icon-svg">

      <path

        className="website-pricing-card__icon-enterprise-crown"

        d="M12 20 16 14l8 6 8-6 4 6v14H12V20Z"

        stroke="currentColor"

        strokeWidth="2.25"

        strokeLinejoin="round"

      />

      <path

        className="website-pricing-card__icon-enterprise-gem"

        d="M24 14v4M20 18h8"

        stroke="currentColor"

        strokeWidth="2"

        strokeLinecap="round"

      />

      <rect

        className="website-pricing-card__icon-enterprise-layer website-pricing-card__icon-enterprise-layer--1"

        x="14"

        y="28"

        width="20"

        height="4"

        rx="1"

        fill="currentColor"

      />

      <rect

        className="website-pricing-card__icon-enterprise-layer website-pricing-card__icon-enterprise-layer--2"

        x="16"

        y="34"

        width="16"

        height="3"

        rx="1"

        fill="currentColor"

      />

      <circle

        className="website-pricing-card__icon-enterprise-orbit"

        cx="36"

        cy="16"

        r="2"

        fill="currentColor"

      />

      <path

        className="website-pricing-card__icon-enterprise-star"

        d="M8 30l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3Z"

        fill="currentColor"

      />

    </svg>

  );

}



function DefaultPackageIcon() {

  return (

    <svg viewBox="0 0 48 48" fill="none" className="website-pricing-card__icon-svg">

      <rect

        x="8"

        y="10"

        width="32"

        height="24"

        rx="4"

        stroke="currentColor"

        strokeWidth="2.5"

      />

      <path d="M8 18h32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />

      <circle cx="14" cy="14" r="1.8" fill="currentColor" />

      <circle cx="19" cy="14" r="1.8" fill="currentColor" />

      <path

        d="M16 28h16M16 24h10"

        stroke="currentColor"

        strokeWidth="2.5"

        strokeLinecap="round"

      />

    </svg>

  );

}



function PackageIcon({

  packageId,

  highlighted,

}: {

  packageId: string;

  highlighted: boolean;

}) {

  const variant = resolvePackageIconVariant(packageId);



  return (

    <span

      className={[

        "website-pricing-card__icon",

        `website-pricing-card__icon--${variant}`,

        highlighted ? "website-pricing-card__icon--featured" : "",

      ]

        .filter(Boolean)

        .join(" ")}

      aria-hidden

    >

      <span className="website-pricing-card__icon-ring" />

      <span className="website-pricing-card__icon-ring website-pricing-card__icon-ring--2" />

      {variant === "starter" ? <StarterPackageIcon /> : null}

      {variant === "business" ? <BusinessPackageIcon /> : null}

      {variant === "enterprise" ? <EnterprisePackageIcon /> : null}

      {variant === "default" ? <DefaultPackageIcon /> : null}

    </span>

  );

}



function formatPrice(price: number, currency: string): string {
  if (currency === "BDT") return `৳${price.toLocaleString("en-BD")}`;
  return `${currency} ${price.toLocaleString()}`;
}

const ENTERPRISE_FRONTEND_STACK = [
  "Next.js",
  "React",
  "Tailwind",
  "TypeScript",
] as const;

const ENTERPRISE_BACKEND_STACK = [
  "NestJS",
  "MongoDB",
  "Redis",
  "BullMQ",
  "JWT",
  "Socket.IO",
] as const;

const STARTER_FRONTEND_STACK = ["HTML", "CSS", "Bootstrap", "JavaScript"] as const;
const STARTER_BACKEND_STACK = ["PHP", "Laravel", "MySQL"] as const;

const BUSINESS_FRONTEND_STACK = [
  "Vue 3",
  "Vite",
  "Pinia",
  "Vue Router",
  "Tailwind CSS 4",
  "Axios",
] as const;
const BUSINESS_BACKEND_STACK = ["PHP", "Laravel", "MySQL", "Redis"] as const;

type PackageTechTier = "starter" | "business" | "enterprise";

type PackageTechConfig = {
  frontend: readonly string[];
  backend: readonly string[];
  defaultFootnote: string;
};

const PACKAGE_TECH_CONFIG: Record<PackageTechTier, PackageTechConfig> = {
  starter: {
    frontend: STARTER_FRONTEND_STACK,
    backend: STARTER_BACKEND_STACK,
    defaultFootnote: "Website Suitable for Small Business",
  },
  business: {
    frontend: BUSINESS_FRONTEND_STACK,
    backend: BUSINESS_BACKEND_STACK,
    defaultFootnote: "Website Suitable for Medium Company",
  },
  enterprise: {
    frontend: ENTERPRISE_FRONTEND_STACK,
    backend: ENTERPRISE_BACKEND_STACK,
    defaultFootnote: "Website Suitable for Large Company",
  },
};

function resolvePackageTechTier(pkg: WebsitePricingPackage): PackageTechTier | null {
  const id = pkg.id.toLowerCase();
  const name = pkg.name.trim().toLowerCase();
  const subtitle = pkg.subtitle?.trim() ?? "";

  if (id.includes("starter") || name === "starter") return "starter";
  if (id.includes("business") || name === "business") return "business";
  if (
    id.includes("enterprise") ||
    name === "enterprise" ||
    subtitle.includes("Frontend:")
  ) {
    return "enterprise";
  }

  return null;
}

function sanitizePackageFootnote(
  subtitle: string,
  tier: PackageTechTier,
): string {
  const trimmed = subtitle.trim();
  const fallback = PACKAGE_TECH_CONFIG[tier].defaultFootnote;

  if (!trimmed) return fallback;
  if (
    trimmed.includes("Frontend:") ||
    trimmed.includes("Backend:") ||
    trimmed.includes("PHP/Laravel")
  ) {
    return fallback;
  }

  return trimmed;
}

function FrontendStackIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="4" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 7.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="6" y="10" width="4" height="3" rx="0.6" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function BackendStackIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <ellipse cx="10" cy="10" rx="7" ry="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 10h10M10 5v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PackageTechSubtitle({
  config,
  footnote,
}: {
  config: PackageTechConfig;
  footnote?: string;
}) {
  return (
    <div className="website-pricing-card__tech-subtitle">
      <div className="website-pricing-card__tech-block">
        <p className="website-pricing-card__tech-heading">
          <span className="website-pricing-card__tech-heading-row">
            <span className="website-pricing-card__tech-heading-icon" aria-hidden>
              <FrontendStackIcon />
            </span>
            <span className="website-pricing-card__tech-heading-text">Frontend</span>
          </span>
          <span className="website-pricing-card__tech-heading-line" aria-hidden />
        </p>
        <div className="website-pricing-card__tech-tags">
          {config.frontend.map((tech) => (
            <span key={tech} className="website-pricing-card__tech-tag">
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div className="website-pricing-card__tech-between" aria-hidden>
        <span className="website-pricing-card__tech-between-line" />
      </div>

      <div className="website-pricing-card__tech-block">
        <p className="website-pricing-card__tech-heading">
          <span className="website-pricing-card__tech-heading-row">
            <span className="website-pricing-card__tech-heading-icon" aria-hidden>
              <BackendStackIcon />
            </span>
            <span className="website-pricing-card__tech-heading-text">Backend</span>
          </span>
          <span className="website-pricing-card__tech-heading-line" aria-hidden />
        </p>
        <div
          className={`website-pricing-card__tech-tags ${config.backend.length >= 6 ? "website-pricing-card__tech-tags--backend" : ""}`}
        >
          {config.backend.map((tech) => (
            <span key={tech} className="website-pricing-card__tech-tag">
              {tech}
            </span>
          ))}
        </div>
      </div>

      {footnote ? (
        <p className="website-pricing-card__tech-footnote">{footnote}</p>
      ) : null}
    </div>
  );
}

function PricingCard({ pkg }: { pkg: WebsitePricingPackage }) {
  const href = (pkg.ctaHref || "/support") as Route;
  const techTier = resolvePackageTechTier(pkg);
  const techConfig = techTier ? PACKAGE_TECH_CONFIG[techTier] : null;

  return (

    <article

      className={`website-pricing-card ${pkg.highlighted ? "website-pricing-card--featured" : ""} ${techConfig ? "website-pricing-card--tech-stack" : ""} ${techTier ? `website-pricing-card--${techTier}` : ""}`}

    >

      {pkg.badge ? (

        <span className="website-pricing-card__badge">{pkg.badge}</span>

      ) : null}



      <div className="website-pricing-card__top">

        <PackageIcon packageId={pkg.id} highlighted={pkg.highlighted} />

        <p className="website-pricing-card__name">{pkg.name}</p>

        {techConfig && techTier ? (
          <PackageTechSubtitle
            config={techConfig}
            footnote={sanitizePackageFootnote(pkg.subtitle ?? "", techTier)}
          />
        ) : pkg.subtitle ? (
          <p className="website-pricing-card__subtitle">{pkg.subtitle}</p>
        ) : null}

      </div>



      <div className="website-pricing-card__price-wrap">

        <p className="website-pricing-card__price">

          {formatPrice(pkg.price, pkg.currency)}

        </p>

        {pkg.priceLabel ? (

          <span className="website-pricing-card__price-label">{pkg.priceLabel}</span>

        ) : null}

      </div>



      <div className="website-pricing-card__features">

        <p className="website-pricing-card__features-heading">

          {pkg.featuresHeading || "All features"}

        </p>

        <ul className="website-pricing-card__feature-list">

          {pkg.features.map((feature) => (

            <li key={feature} className="website-pricing-card__feature-item">

              <span className="website-pricing-card__check" aria-hidden>

                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">

                  <path

                    d="M3.5 8.2 6.4 11l6.1-6"

                    stroke="currentColor"

                    strokeWidth="2"

                    strokeLinecap="round"

                    strokeLinejoin="round"

                  />

                </svg>

              </span>

              <span>{feature}</span>

            </li>

          ))}

        </ul>

      </div>



      <Link href={href} className="website-pricing-card__cta">

        <span className="website-pricing-card__cta-icon" aria-hidden>

          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">

            <path

              d="M4 10h12M12 6l4 4-4 4"

              stroke="currentColor"

              strokeWidth="2"

              strokeLinecap="round"

              strokeLinejoin="round"

            />

          </svg>

        </span>

        {pkg.ctaLabel || "Get Started"}

      </Link>

    </article>

  );

}



type WebsitePricingSectionProps = {

  packages: WebsitePricingPackage[];

};



export function WebsitePricingSection({

  packages,

}: WebsitePricingSectionProps) {

  const visiblePackages = packages.filter((pkg) => pkg.enabled && pkg.name.trim());



  return (

    <section className="website-pricing">

      <div className="website-pricing__grid-bg" aria-hidden />



      <div className="website-pricing__cards">

        {visiblePackages.map((pkg) => (

          <PricingCard key={pkg.id} pkg={pkg} />

        ))}

      </div>

    </section>

  );

}


