export type WebsitePricingPackage = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  currency: string;
  priceLabel: string;
  badge: string;
  highlighted: boolean;
  featuresHeading: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  enabled: boolean;
  sortOrder: number;
};

export type WebsiteGuideStep = {
  number: string;
  title: string;
  body: string;
};

export type WebsiteIntroSection = {
  title: string;
  paragraphs: string[];
};

export type WebsiteGuideSection = {
  title: string;
  steps: WebsiteGuideStep[];
};

export type WebsitePageSettings = {
  heroEyebrow: string;
  heading: string;
  subheading: string;
  offerTitle: string;
  offerText: string;
  heroNoteTitle: string;
  heroNoteText: string;
  heroNoteSubtext: string;
  introSection: WebsiteIntroSection;
  guideSection: WebsiteGuideSection;
  packages: WebsitePricingPackage[];
  updatedAt?: string;
};

const DEFAULT_INTRO_SECTION: WebsiteIntroSection = {
  title: "Best Website Development Company in Bangladesh",
  paragraphs: [
    "Looking for a trusted web development partner in Bangladesh? UniQbd delivers professional websites built for speed, security, and long-term growth.",
    "Our expert team creates visually appealing, mobile-responsive websites with modern features — from sliding banners and dynamic pages to SEO-ready structure and spam-protected contact forms.",
    "Whether you run a small business or a growing company, we handle design, development, and launch so your brand can stand out online with confidence.",
  ],
};

const DEFAULT_GUIDE_SECTION: WebsiteGuideSection = {
  title: "What's first up for your business?",
  steps: [
    {
      number: "01",
      title: "Choose your website package",
      body: "Pick the Starter, Business, or Enterprise plan that matches your goals. Every package includes responsive design, dynamic pages, and delivery within 10–15 working days.",
    },
    {
      number: "02",
      title: "Share your brand content",
      body: "Send your logo, business details, photos, and page ideas. We structure your homepage, gallery, and contact forms to match your brand and help customers reach you easily.",
    },
    {
      number: "03",
      title: "Launch your website live",
      body: "We publish your site on your domain with SSL, test every page on mobile and desktop, and provide admin panel training. Post-launch technical support is included so your business can go online with confidence.",
    },
  ],
};

export const DEFAULT_WEBSITE_PAGE_SETTINGS: WebsitePageSettings = {
  heroEyebrow: "Website Development",
  heading: "Website Development Package & Price",
  subheading: "Best Web Development Company in Bangladesh",
  offerTitle: "বিশেষ অফার:",
  offerText:
    "সীমিত সময়ের অফার — যেকোনো ওয়েবসাইট প্যাকেজে ১০টি অতিরিক্ত পেজ মাত্র ৳৫,০০০-এ! আরও বেশি কন্টেন্ট ও ফিচার নিয়ে আপনার ওয়েবসাইট আরও সম্পূর্ণ করুন।",
  heroNoteTitle: "",
  heroNoteText: "কাস্টমারের রিকুয়ারমেন্ট অনুযায়ী ওয়েবসাইট বানানো হয়।",
  heroNoteSubtext:
    "আপনার ব্যবসার ধরন, কন্টেন্ট ও ফিচার অনুযায়ী প্রতিটি ওয়েবসাইট আলাদাভাবে তৈরি করা হয়।",
  introSection: DEFAULT_INTRO_SECTION,
  guideSection: DEFAULT_GUIDE_SECTION,
  packages: [
    {
      id: "starter",
      name: "Starter",
      subtitle: "Website Suitable for Small Business",
      price: 19990,
      currency: "BDT",
      priceLabel: "",
      badge: "",
      highlighted: false,
      featuresHeading: "All features",
      features: [
        "Fully Responsive Design",
        "Modern Homepage with Sliding Banner",
        "3–5 Customizable Dynamic Pages",
        "Dynamic Photo Gallery",
        "Basic On-Page SEO",
        "Contact Form with Spam Protection",
        "Delivery Time: 10–15 Working Days",
        "15 Days Free Technical Support",
      ],
      ctaLabel: "Get Started",
      ctaHref: "/support",
      enabled: true,
      sortOrder: 0,
    },
    {
      id: "business",
      name: "Business",
      subtitle: "Website Suitable for Medium Company",
      price: 29990,
      currency: "BDT",
      priceLabel: "",
      badge: "Most Popular",
      highlighted: true,
      featuresHeading: "All features",
      features: [
        "Fully Responsive Design",
        "Modern Homepage with Sliding Banner",
        "5–8 Customizable Dynamic Pages",
        "Dynamic Photo Gallery",
        "Basic On-Page SEO",
        "Search Engine Submission",
        "1 Month Free Technical Support",
        "Delivery Time: 10–15 Working Days",
        "Google Analytics Setup",
        "Contact Form with Spam Protection",
        "Additional Page(s): ৳3000/page",
        "LIVE CHAT integration",
      ],
      ctaLabel: "Get Started",
      ctaHref: "/support",
      enabled: true,
      sortOrder: 1,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      subtitle: "Website Suitable for Large Company",
      price: 44990,
      currency: "BDT",
      priceLabel: "",
      badge: "",
      highlighted: false,
      featuresHeading: "All features",
      features: [
        "Fully Responsive Design",
        "Modern Homepage with Sliding Banner",
        "10+ Customizable Dynamic Pages",
        "Dynamic Photo Gallery",
        "Advanced On-Page SEO",
        "Search Engine Submission",
        "3 Months Free Technical Support",
        "Delivery Time: 10–15 Working Days",
        "Google Analytics Setup",
        "Contact Form with Spam Protection",
        "Additional Page(s): ৳2500/page",
        "LIVE CHAT integration",
        "Admin Dashboard Training",
        "Priority Support Channel",
      ],
      ctaLabel: "Get Started",
      ctaHref: "/support",
      enabled: true,
      sortOrder: 2,
    },
  ],
};

const HERO_NOTE_SPLIT_MARKER = "। আপনার ব্যবসার";

const LEGACY_GUIDE_STEP_03_MARKERS = ["AI Chat", "CRM software", "CRM সফট"];

function normalizeHeroFields(
  value?: {
    heading?: string;
    subheading?: string;
  } | null,
): { heading: string; subheading: string } {
  let heading =
    value?.heading?.trim() || DEFAULT_WEBSITE_PAGE_SETTINGS.heading;
  let subheading =
    value?.subheading?.trim() || DEFAULT_WEBSITE_PAGE_SETTINGS.subheading;

  if (heading === "Website Packages") {
    heading = DEFAULT_WEBSITE_PAGE_SETTINGS.heading;
  }
  if (
    subheading.includes("Professional PHP/Laravel") ||
    subheading.includes("tailored for your business")
  ) {
    subheading = DEFAULT_WEBSITE_PAGE_SETTINGS.subheading;
  }

  return { heading, subheading };
}

function normalizeHeroNoteFields(
  value?: {
    heroNoteText?: string;
    heroNoteSubtext?: string;
  } | null,
): { heroNoteText: string; heroNoteSubtext: string } {
  let heroNoteText =
    value?.heroNoteText?.trim() || DEFAULT_WEBSITE_PAGE_SETTINGS.heroNoteText;
  let heroNoteSubtext = value?.heroNoteSubtext?.trim() ?? "";

  if (heroNoteText.includes(HERO_NOTE_SPLIT_MARKER)) {
    const splitAt = heroNoteText.indexOf(HERO_NOTE_SPLIT_MARKER);
    const trailing = heroNoteText.slice(splitAt + 2).trim();
    heroNoteText = heroNoteText.slice(0, splitAt + 1).trim();
    if (!heroNoteSubtext) {
      heroNoteSubtext = trailing;
    }
  }

  if (!heroNoteSubtext) {
    heroNoteSubtext = DEFAULT_WEBSITE_PAGE_SETTINGS.heroNoteSubtext;
  }

  return { heroNoteText, heroNoteSubtext };
}

export function normalizeWebsitePageSettings(
  value?: Partial<WebsitePageSettings> | null,
): WebsitePageSettings {
  const packages = (value?.packages ?? DEFAULT_WEBSITE_PAGE_SETTINGS.packages)
    .map((pkg, index) => {
      const id = pkg.id?.trim() || `package-${index + 1}`;
      const name = pkg.name?.trim() ?? "";
      let subtitle = pkg.subtitle?.trim() ?? "";
      const idLower = id.toLowerCase();
      const nameLower = name.toLowerCase();

      if (
        (idLower.includes("starter") || nameLower === "starter") &&
        (subtitle.includes("PHP/Laravel") ||
          subtitle.includes("Frontend:") ||
          subtitle.includes("Backend:"))
      ) {
        subtitle = "Website Suitable for Small Business";
      } else if (
        (idLower.includes("business") || nameLower === "business") &&
        (subtitle.includes("PHP/Laravel") ||
          subtitle.includes("Frontend:") ||
          subtitle.includes("Backend:"))
      ) {
        subtitle = "Website Suitable for Medium Company";
      } else if (
        (idLower.includes("enterprise") || nameLower === "enterprise") &&
        (subtitle.includes("PHP/Laravel") ||
          subtitle.includes("Frontend:") ||
          subtitle.includes("Backend:"))
      ) {
        subtitle = "Website Suitable for Large Company";
      }
      return {
      id,
      name: pkg.name?.trim() ?? "",
      subtitle,
      price: Math.max(0, Number(pkg.price ?? 0)),
      currency: pkg.currency?.trim() || "BDT",
      priceLabel: pkg.priceLabel?.trim() ?? "",
      badge: pkg.badge?.trim() ?? "",
      highlighted: Boolean(pkg.highlighted),
      featuresHeading: pkg.featuresHeading?.trim() || "All features",
      features: (pkg.features ?? []).map((f) => f.trim()).filter(Boolean),
      ctaLabel: pkg.ctaLabel?.trim() || "Get Started",
      ctaHref: pkg.ctaHref?.trim() || "/support",
      enabled: pkg.enabled !== false,
      sortOrder: typeof pkg.sortOrder === "number" ? pkg.sortOrder : index,
    };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    heroEyebrow:
      value?.heroEyebrow?.trim() || DEFAULT_WEBSITE_PAGE_SETTINGS.heroEyebrow,
    ...normalizeHeroFields(value),
    offerTitle:
      value?.offerTitle?.trim() || DEFAULT_WEBSITE_PAGE_SETTINGS.offerTitle,
    offerText:
      value?.offerText?.trim() || DEFAULT_WEBSITE_PAGE_SETTINGS.offerText,
    heroNoteTitle: value?.heroNoteTitle?.trim() ?? "",
    ...normalizeHeroNoteFields(value),
    introSection: {
      title:
        value?.introSection?.title?.trim() ||
        DEFAULT_INTRO_SECTION.title,
      paragraphs:
        value?.introSection?.paragraphs?.map((p) => p.trim()).filter(Boolean)
          .length
          ? value.introSection.paragraphs
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, index) =>
                index === 0 && p.includes("PHP/Laravel")
                  ? p.replace("PHP/Laravel ", "")
                  : p,
              )
          : DEFAULT_INTRO_SECTION.paragraphs,
    },
    guideSection: {
      title:
        value?.guideSection?.title?.trim() ||
        DEFAULT_GUIDE_SECTION.title,
      steps:
        value?.guideSection?.steps?.length
          ? value.guideSection.steps.map((step, index) => {
              const normalized = {
                number:
                  step.number?.trim() ||
                  String(index + 1).padStart(2, "0"),
                title: step.title?.trim() ?? "",
                body: step.body?.trim() ?? "",
              };
              if (
                index === 2 &&
                LEGACY_GUIDE_STEP_03_MARKERS.some(
                  (marker) =>
                    normalized.title.includes(marker) ||
                    normalized.body.includes(marker),
                )
              ) {
                return DEFAULT_GUIDE_SECTION.steps[2] ?? normalized;
              }
              return normalized;
            })
          : DEFAULT_GUIDE_SECTION.steps,
    },
    packages: packages.length > 0 ? packages : DEFAULT_WEBSITE_PAGE_SETTINGS.packages,
    updatedAt: value?.updatedAt,
  };
}

export function getVisibleWebsitePackages(
  settings: WebsitePageSettings,
): WebsitePricingPackage[] {
  return settings.packages.filter((pkg) => pkg.enabled && pkg.name.trim());
}
