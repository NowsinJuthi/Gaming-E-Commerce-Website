import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlogStatus } from '../../common/enums/blog.enum';
import { ProductStatus } from '../../common/enums';
import { Blog, BlogDocument } from '../../database/schemas/blog.schema';
import {
  BlogCategory,
  BlogCategoryDocument,
} from '../../database/schemas/blog-category.schema';
import { Brand, BrandDocument } from '../../database/schemas/brand.schema';
import {
  Category,
  CategoryDocument,
} from '../../database/schemas/category.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import {
  SeoSettings,
  SeoSettingsDocument,
} from '../../database/schemas/seo-settings.schema';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import { deepReplaceLegacyBrand } from '../../common/utils/legacy-brand-migration';
import { UpdateSeoSettingsDto } from './dto/update-seo-settings.dto';

const SETTINGS_KEY = 'global';
/** Static storefront routes included in `apps/web/src/app/sitemap.ts`. */
const SITEMAP_STATIC_PAGES = 12;

type StaticPageSeoSeed = {
  path: string;
  label: string;
  title: string;
  description: string;
  keywords?: string[];
};

const STATIC_PAGE_SEO_DEFAULTS: StaticPageSeoSeed[] = [
  {
    path: '/about',
    label: 'About Us',
    title: 'About Us',
    description:
      "Learn about {siteName} — Bangladesh's trusted digital marketplace for gaming top-ups, gift cards, and instant delivery.",
  },
  {
    path: '/contact',
    label: 'Contact Us',
    title: 'Contact Us',
    description: 'Contact {siteName} for support and inquiries.',
  },
  {
    path: '/website',
    label: 'Website Packages',
    title: 'Website Packages',
    description:
      'Professional website packages from {siteName} — Starter, Business, and Enterprise solutions for your business.',
  },
  {
    path: '/privacy-policy/',
    label: 'Privacy Policy',
    title: 'Privacy Policy',
    description:
      "Read {siteName}'s Privacy Policy — how we collect, use, and protect your information.",
  },
  {
    path: '/terms-conditions/',
    label: 'Terms & Conditions',
    title: 'Terms & Conditions',
    description:
      "Read {siteName}'s Terms of Service for using our digital marketplace in Bangladesh.",
  },
  {
    path: '/disclaimers/',
    label: 'Disclaimers',
    title: 'Disclaimers',
    description:
      "Read {siteName}'s disclaimers for website use, gift cards, direct top-ups, and related services.",
  },
  {
    path: '/refund-and-returns-policy/',
    label: 'Refund & Returns Policy',
    title: 'Refund And Returns Policy',
    description:
      "Read {siteName}'s refund, return, exchange, and gift policy for digital purchases in Bangladesh.",
  },
  {
    path: '/request-product',
    label: 'Request Product',
    title: 'Request New Product',
    description:
      "Can't find a product on {siteName}? Request it and we'll try to add it for you.",
  },
  {
    path: '/products',
    label: 'Shop / Products',
    title: 'All Products',
    description:
      'Browse all digital products on {siteName} — game top-ups, gift cards, software licenses and subscriptions with instant delivery.',
    keywords: ['game top-ups', 'gift cards', 'digital goods', 'Bangladesh'],
  },
  {
    path: '/blog',
    label: 'Blog',
    title: 'Blog',
    description:
      'Read guides, updates, and digital shopping tips on the {siteName} blog.',
    keywords: ['blog', 'guides', 'digital goods', 'gaming', 'gift cards', 'Bangladesh'],
  },
  {
    path: '/reviews',
    label: 'Reviews',
    title: 'Reviews',
    description: 'Read verified customer reviews for digital products on {siteName}.',
    keywords: ['reviews', 'customer reviews', 'digital goods', 'gaming', 'gift cards', 'Bangladesh'],
  },
];

/**
 * Admins often paste the full `<meta ... content="TOKEN" />` snippet from
 * Google/Bing instead of just the token. Accept both and store only the token,
 * otherwise the rendered meta tag is nested garbage and verification fails.
 */
function normalizeVerificationCode(raw?: string): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const fromTag = /content\s*=\s*["']([^"']*)["']/i.exec(value);
  if (fromTag?.[1] !== undefined) return fromTag[1].trim();
  return value.replace(/^["']+|["']+$/g, '').trim();
}

/** GA4 measurement ID (`G-XXXX`) or legacy `UA-XXXX-X`, even when pasted with
 * surrounding label text ("Measurement Id G-…") or a full gtag snippet. */
function normalizeGoogleAnalyticsId(raw?: string): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const match = /\b(G-[A-Z0-9]{4,}|UA-\d+-\d+)\b/i.exec(value);
  return match?.[1] ? match[1].toUpperCase() : value;
}

/** GTM container ID (`GTM-XXXX`), tolerant of pasted snippets/labels. */
function normalizeGtmId(raw?: string): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const match = /\bGTM-[A-Z0-9]{4,}\b/i.exec(value);
  return match ? match[0].toUpperCase() : value;
}

/** Facebook Pixel ID is numeric; pull it out of a pasted fbq snippet if needed. */
function normalizeFacebookPixelId(raw?: string): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  if (/^\d+$/.test(value)) return value;
  const match = /\b(\d{9,20})\b/.exec(value);
  return match?.[1] ?? value;
}

export interface PublicSeoConfig {
  siteTitle: string;
  siteDescription: string;
  keywords: string[];
  canonicalDomain: string;
  robots: { index: boolean; follow: boolean };
  verification: { google: string; bing: string };
  analytics: { googleAnalyticsId: string; gtmId: string; facebookPixelId: string };
  homepage: {
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
  };
  social: {
    facebook: string;
    instagram: string;
    youtube: string;
    twitter: string;
    discord: string;
  };
  schema: {
    organization: boolean;
    website: boolean;
    product: boolean;
    faq: boolean;
    faqItems: Array<{ question: string; answer: string }>;
  };
  staticPages: Array<{
    path: string;
    label: string;
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    noIndex: boolean;
  }>;
}

@Injectable()
export class SeoSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SeoSettingsService.name);

  constructor(
    @InjectModel(SeoSettings.name)
    private readonly settingsModel: Model<SeoSettingsDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Brand.name)
    private readonly brandModel: Model<BrandDocument>,
    @InjectModel(Blog.name)
    private readonly blogModel: Model<BlogDocument>,
    @InjectModel(BlogCategory.name)
    private readonly blogCategoryModel: Model<BlogCategoryDocument>,
    private readonly cacheService: CacheService,
  ) {}

  /** Replace leftover legacy branding in stored SEO settings on startup. */
  async onModuleInit(): Promise<void> {
    try {
      const doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
      if (!doc) return;

      let dirty = false;
      const paths = [
        'global',
        'homepage',
        'social',
        'schema',
        'robots',
        'sitemap',
      ] as const;

      for (const path of paths) {
        const current = doc[path];
        if (!current) continue;
        const result = deepReplaceLegacyBrand(current);
        if (result.changed) {
          (doc as unknown as Record<string, unknown>)[path] = result.value;
          doc.markModified(path);
          dirty = true;
        }
      }

      if (dirty) {
        await doc.save();
        await this.invalidateCache();
        this.logger.log('Migrated legacy brand text to UniQbd in SEO settings');
      }
    } catch (err) {
      this.logger.warn('Could not run legacy brand migration in SEO settings', err);
    }
  }

  async invalidateCache(): Promise<void> {
    await this.cacheService.del(CacheKeys.settings.seo);
  }

  async getSettings(): Promise<SeoSettingsDocument> {
    return this.getOrCreate();
  }

  async getPublicConfig(): Promise<PublicSeoConfig> {
    const cached = await this.cacheService.getJson<PublicSeoConfig>(CacheKeys.settings.seo);
    if (cached) return cached;
    const doc = await this.getOrCreate();
    const value = this.toPublicConfig(doc);
    await this.cacheService.setJson(CacheKeys.settings.seo, value, CacheKeys.ttl.settingsSeo);
    return value;
  }

  async updateSettings(
    dto: UpdateSeoSettingsDto,
  ): Promise<SeoSettingsDocument> {
    const doc = await this.getOrCreate();
    if (dto.global) {
      if (dto.global.googleVerification !== undefined) {
        dto.global.googleVerification = normalizeVerificationCode(
          dto.global.googleVerification,
        );
      }
      if (dto.global.bingVerification !== undefined) {
        dto.global.bingVerification = normalizeVerificationCode(
          dto.global.bingVerification,
        );
      }
      if (dto.global.googleAnalyticsId !== undefined) {
        dto.global.googleAnalyticsId = normalizeGoogleAnalyticsId(
          dto.global.googleAnalyticsId,
        );
      }
      if (dto.global.gtmId !== undefined) {
        dto.global.gtmId = normalizeGtmId(dto.global.gtmId);
      }
      if (dto.global.facebookPixelId !== undefined) {
        dto.global.facebookPixelId = normalizeFacebookPixelId(
          dto.global.facebookPixelId,
        );
      }
      Object.assign(doc.global, dto.global);
    }
    if (dto.homepage) Object.assign(doc.homepage, dto.homepage);
    if (dto.social) Object.assign(doc.social, dto.social);
    if (dto.schema) {
      const { faqItems, ...rest } = dto.schema;
      Object.assign(doc.schema, rest);
      if (faqItems) {
        doc.schema.faqItems = faqItems.map((f) => ({
          question: f.question ?? '',
          answer: f.answer ?? '',
        }));
      }
    }
    if (dto.staticPages) {
      doc.staticPages = dto.staticPages.map((page) => ({
        path: page.path.trim(),
        label: page.label.trim(),
        title: page.title?.trim() ?? '',
        description: page.description?.trim() ?? '',
        keywords: (page.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean),
        ogTitle: page.ogTitle?.trim() ?? '',
        ogDescription: page.ogDescription?.trim() ?? '',
        ogImage: page.ogImage?.trim() ?? '',
        noIndex: page.noIndex ?? false,
      }));
      doc.markModified('staticPages');
    }
    if (dto.autoGenerateProductSeo !== undefined) {
      doc.autoGenerateProductSeo = dto.autoGenerateProductSeo;
    }
    await doc.save();
    await this.invalidateCache();
    return doc;
  }

  // --- Robots.txt -----------------------------------------------------------

  /** Effective robots.txt body served to crawlers. */
  async getRobotsContent(): Promise<string> {
    const doc = await this.getOrCreate();
    if (doc.robots.useCustom && doc.robots.content.trim()) {
      return doc.robots.content;
    }
    return this.defaultRobots(doc.global.canonicalDomain);
  }

  async saveRobots(
    content: string,
    useCustom: boolean,
  ): Promise<SeoSettingsDocument> {
    const doc = await this.getOrCreate();
    doc.robots.content = content;
    doc.robots.useCustom = useCustom;
    await doc.save();
    await this.invalidateCache();
    return doc;
  }

  defaultRobots(domain: string): string {
    const base = (domain || 'https://uniqbd.com').replace(/\/$/, '');
    const disallow = [
      '/admin',
      '/api',
      '/cart',
      '/checkout',
      '/dashboard',
      '/orders',
      '/wallet',
      '/wishlist',
      '/profile',
      '/settings',
      '/affiliate',
      '/referral',
      '/rewards',
      '/support',
      '/chat',
      '/notifications',
      '/reseller',
      '/tickets',
      '/downloads',
      '/login',
      '/register',
      '/verify-email',
      '/order/thank-you',
      '/*?*',
    ];
    return [
      'User-agent: *',
      'Allow: /',
      ...disallow.map((d) => `Disallow: ${d}`),
      '',
      `Sitemap: ${base}/sitemap.xml`,
      `Host: ${base}`,
      '',
    ].join('\n');
  }

  /** Lightweight robots.txt linter. */
  validateRobots(content: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = content.split(/\r?\n/);
    let hasUserAgent = false;
    let hasSitemap = false;
    const directiveRe =
      /^(user-agent|allow|disallow|sitemap|host|crawl-delay)\s*:/i;

    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      if (!directiveRe.test(line)) {
        errors.push(`Line ${i + 1}: unrecognized directive "${line}".`);
        return;
      }
      const key = line.split(':')[0]?.trim().toLowerCase();
      if (key === 'user-agent') hasUserAgent = true;
      if (key === 'sitemap') {
        hasSitemap = true;
        const value = line.slice(line.indexOf(':') + 1).trim();
        if (!/^https?:\/\//i.test(value)) {
          warnings.push(`Line ${i + 1}: Sitemap should be an absolute URL.`);
        }
      }
    });

    if (!hasUserAgent) {
      errors.push('Missing required "User-agent" directive.');
    }
    if (!hasSitemap) {
      warnings.push('No "Sitemap" directive found — recommended for SEO.');
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  // --- Sitemap --------------------------------------------------------------

  private canonicalBase(domain?: string): string {
    return (domain || 'https://uniqbd.com').replace(/\/$/, '');
  }

  /** Mirrors the storefront `sitemap.ts` URL inventory for admin stats. */
  private async countSitemapUrls(): Promise<number> {
    const [products, categories, brands, blogPosts, blogCategories] =
      await Promise.all([
        this.productModel
          .countDocuments({
            status: { $in: [ProductStatus.Active, ProductStatus.OutOfStock] },
          })
          .exec(),
        this.categoryModel
          .countDocuments({ isActive: { $ne: false } })
          .exec(),
        this.brandModel.countDocuments({}).exec(),
        this.blogModel
          .countDocuments({ status: BlogStatus.Published })
          .exec(),
        this.blogCategoryModel
          .countDocuments({ isActive: { $ne: false } })
          .exec(),
      ]);

    return (
      products +
      categories +
      brands +
      blogPosts +
      blogCategories +
      SITEMAP_STATIC_PAGES
    );
  }

  async getSitemapStatus(): Promise<{
    lastGeneratedAt: Date | null;
    urlCount: number;
    status: string;
    sitemapUrl: string;
  }> {
    const doc = await this.getOrCreate();
    const base = this.canonicalBase(doc.global.canonicalDomain);
    const liveCount = await this.countSitemapUrls();
    const lastGeneratedAt = doc.sitemap.lastGeneratedAt ?? null;
    const status = lastGeneratedAt
      ? doc.sitemap.status
      : liveCount > 0
        ? 'live'
        : 'idle';

    return {
      lastGeneratedAt,
      urlCount: liveCount,
      status,
      sitemapUrl: `${base}/sitemap.xml`,
    };
  }

  /**
   * Recomputes sitemap statistics. The sitemap.xml itself is generated live by
   * the storefront (Next.js `sitemap.ts`); this records freshness + URL count
   * for the dashboard and acts as the "regenerate" trigger.
   */
  async regenerateSitemap(): Promise<{
    lastGeneratedAt: Date | null;
    urlCount: number;
    status: string;
    sitemapUrl: string;
  }> {
    const urlCount = await this.countSitemapUrls();

    const doc = await this.getOrCreate();
    doc.sitemap.lastGeneratedAt = new Date();
    doc.sitemap.urlCount = urlCount;
    doc.sitemap.status = 'ready';
    await doc.save();
    await this.invalidateCache();
    return this.getSitemapStatus();
  }

  // --- internals ------------------------------------------------------------

  private async getOrCreate(): Promise<SeoSettingsDocument> {
    let doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.settingsModel.create({
        key: SETTINGS_KEY,
        staticPages: this.createDefaultStaticPages(),
      });
      return doc;
    }

    if (!doc.staticPages?.length) {
      doc.staticPages = this.createDefaultStaticPages();
      doc.markModified('staticPages');
      await doc.save();
    }

    return doc;
  }

  private createDefaultStaticPages() {
    return STATIC_PAGE_SEO_DEFAULTS.map((entry) => ({
      path: entry.path,
      label: entry.label,
      title: entry.title,
      description: entry.description,
      keywords: entry.keywords ?? [],
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      noIndex: false,
    }));
  }

  private mergeStaticPages(
    stored?: Array<{
      path?: string;
      label?: string;
      title?: string;
      description?: string;
      keywords?: string[];
      ogTitle?: string;
      ogDescription?: string;
      ogImage?: string;
      noIndex?: boolean;
    }>,
  ) {
    const byPath = new Map(
      (stored ?? [])
        .filter((page) => page.path?.trim())
        .map((page) => [page.path!.trim(), page]),
    );

    return STATIC_PAGE_SEO_DEFAULTS.map((entry) => {
      const saved = byPath.get(entry.path);
      return {
        path: entry.path,
        label: saved?.label?.trim() || entry.label,
        title: saved?.title?.trim() || entry.title,
        description: saved?.description?.trim() || entry.description,
        keywords:
          saved?.keywords && saved.keywords.length > 0
            ? saved.keywords
            : (entry.keywords ?? []),
        ogTitle: saved?.ogTitle?.trim() ?? '',
        ogDescription: saved?.ogDescription?.trim() ?? '',
        ogImage: saved?.ogImage?.trim() ?? '',
        noIndex: saved?.noIndex ?? false,
      };
    });
  }

  private toPublicConfig(doc: SeoSettingsDocument): PublicSeoConfig {
    return {
      siteTitle: doc.global.siteTitle,
      siteDescription: doc.global.siteDescription,
      keywords: doc.global.keywords ?? [],
      canonicalDomain: doc.global.canonicalDomain,
      robots: { index: doc.global.robotsIndex, follow: doc.global.robotsFollow },
      verification: {
        // Normalize on read too: values saved before normalization existed may
        // still contain a pasted full <meta> tag.
        google: normalizeVerificationCode(doc.global.googleVerification),
        bing: normalizeVerificationCode(doc.global.bingVerification),
      },
      analytics: {
        // Normalize on read too so values saved before normalization existed
        // (e.g. "Measurement Id G-XXXX") still work without re-saving.
        googleAnalyticsId: normalizeGoogleAnalyticsId(
          doc.global.googleAnalyticsId,
        ),
        gtmId: normalizeGtmId(doc.global.gtmId),
        facebookPixelId: normalizeFacebookPixelId(doc.global.facebookPixelId),
      },
      homepage: {
        title: doc.homepage.title,
        description: doc.homepage.description,
        keywords: doc.homepage.keywords ?? [],
        ogTitle: doc.homepage.ogTitle,
        ogDescription: doc.homepage.ogDescription,
        ogImage: doc.homepage.ogImage,
      },
      social: {
        facebook: doc.social.facebook,
        instagram: doc.social.instagram,
        youtube: doc.social.youtube,
        twitter: doc.social.twitter,
        discord: doc.social.discord,
      },
      schema: {
        organization: doc.schema.organization,
        website: doc.schema.website,
        product: doc.schema.product,
        faq: doc.schema.faq,
        faqItems: (doc.schema.faqItems ?? []).map((f) => ({
          question: f.question,
          answer: f.answer,
        })),
      },
      staticPages: this.mergeStaticPages(doc.staticPages),
    };
  }
}
