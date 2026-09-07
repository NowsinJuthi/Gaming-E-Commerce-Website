import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WebsitePricingPackageDoc,
  WebsiteSettings,
  WebsiteSettingsDocument,
} from '../../database/schemas/website-settings.schema';
import type { UpdateWebsiteSettingsDto } from './dto/update-website-settings.dto';

const SETTINGS_KEY = 'global';

const DEFAULT_OFFER_TEXT =
  'সীমিত সময়ের অফার — যেকোনো ওয়েবসাইট প্যাকেজে ১০টি অতিরিক্ত পেজ মাত্র ৳৫,০০০-এ! আরও বেশি কন্টেন্ট ও ফিচার নিয়ে আপনার ওয়েবসাইট আরও সম্পূর্ণ করুন।';

const LEGACY_OFFER_MARKERS = [
  'AI Chat Assistant',
  'CRM সফটওয়্যার',
  'ডোমেইন কানেকশন',
  'গুগল অ্যানালিটিক্স',
  '৳২৫০০',
];

const HERO_NOTE_SPLIT_MARKER = '। আপনার ব্যবসার';

const DEFAULT_GUIDE_STEP_03 = {
  number: '03',
  title: 'Launch your website live',
  body: 'We publish your site on your domain with SSL, test every page on mobile and desktop, and provide admin panel training. Post-launch technical support is included so your business can go online with confidence.',
};

const LEGACY_GUIDE_STEP_03_MARKERS = ['AI Chat', 'CRM software', 'CRM সফট'];

const DEFAULT_HERO_HEADING = 'Website Development Package & Price';
const DEFAULT_HERO_SUBHEADING = 'Best Web Development Company in Bangladesh';

const DEFAULT_INTRO = {
  title: 'Best Website Development Company in Bangladesh',
  paragraphs: [
    'Looking for a trusted web development partner in Bangladesh? UniQbd delivers professional websites built for speed, security, and long-term growth.',
    'Our expert team creates visually appealing, mobile-responsive websites with modern features — from sliding banners and dynamic pages to SEO-ready structure and spam-protected contact forms.',
    'Whether you run a small business or a growing company, we handle design, development, and launch so your brand can stand out online with confidence.',
  ],
};

const DEFAULT_GUIDE = {
  title: "What's first up for your business?",
  steps: [
    {
      number: '01',
      title: 'Choose your website package',
      body: 'Pick the Starter, Business, or Enterprise plan that matches your goals. Every package includes responsive design, dynamic pages, and delivery within 10–15 working days.',
    },
    {
      number: '02',
      title: 'Share your brand content',
      body: 'Send your logo, business details, photos, and page ideas. We structure your homepage, gallery, and contact forms to match your brand and help customers reach you easily.',
    },
    {
      number: '03',
      title: 'Launch your website live',
      body: 'We publish your site on your domain with SSL, test every page on mobile and desktop, and provide admin panel training. Post-launch technical support is included so your business can go online with confidence.',
    },
  ],
};

const DEFAULT_PACKAGES: WebsitePricingPackageDoc[] = [
  {
    id: 'starter',
    name: 'Starter',
    subtitle: 'Website Suitable for Small Business',
    price: 19990,
    currency: 'BDT',
    priceLabel: '',
    badge: '',
    highlighted: false,
    featuresHeading: 'All features',
    features: [
      'Fully Responsive Design',
      'Modern Homepage with Sliding Banner',
      '3–5 Customizable Dynamic Pages',
      'Dynamic Photo Gallery',
      'Basic On-Page SEO',
      'Contact Form with Spam Protection',
      'Delivery Time: 10–15 Working Days',
      '15 Days Free Technical Support',
    ],
    ctaLabel: 'Get Started',
    ctaHref: '/support',
    enabled: true,
    sortOrder: 0,
  },
  {
    id: 'business',
    name: 'Business',
    subtitle: 'Website Suitable for Medium Company',
    price: 29990,
    currency: 'BDT',
    priceLabel: '',
    badge: 'Most Popular',
    highlighted: true,
    featuresHeading: 'All features',
    features: [
      'Fully Responsive Design',
      'Modern Homepage with Sliding Banner',
      '5–8 Customizable Dynamic Pages',
      'Dynamic Photo Gallery',
      'Basic On-Page SEO',
      'Search Engine Submission',
      '1 Month Free Technical Support',
      'Delivery Time: 10–15 Working Days',
      'Google Analytics Setup',
      'Contact Form with Spam Protection',
      'Additional Page(s): ৳3000/page',
      'LIVE CHAT integration',
    ],
    ctaLabel: 'Get Started',
    ctaHref: '/support',
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    subtitle: 'Website Suitable for Large Company',
    price: 44990,
    currency: 'BDT',
    priceLabel: '',
    badge: '',
    highlighted: false,
    featuresHeading: 'All features',
    features: [
      'Fully Responsive Design',
      'Modern Homepage with Sliding Banner',
      '10+ Customizable Dynamic Pages',
      'Dynamic Photo Gallery',
      'Advanced On-Page SEO',
      'Search Engine Submission',
      '3 Months Free Technical Support',
      'Delivery Time: 10–15 Working Days',
      'Google Analytics Setup',
      'Contact Form with Spam Protection',
      'Additional Page(s): ৳2500/page',
      'LIVE CHAT integration',
      'Admin Dashboard Training',
      'Priority Support Channel',
    ],
    ctaLabel: 'Get Started',
    ctaHref: '/support',
    enabled: true,
    sortOrder: 2,
  },
];

@Injectable()
export class WebsiteSettingsService {
  constructor(
    @InjectModel(WebsiteSettings.name)
    private readonly model: Model<WebsiteSettingsDocument>,
  ) {}

  async getSettings(): Promise<WebsiteSettingsDocument> {
    return this.getOrCreate();
  }

  async updateSettings(
    dto: UpdateWebsiteSettingsDto,
  ): Promise<WebsiteSettingsDocument> {
    const doc = await this.getOrCreate();

    if (dto.heroEyebrow !== undefined) doc.heroEyebrow = dto.heroEyebrow.trim();
    if (dto.heading !== undefined) doc.heading = dto.heading.trim();
    if (dto.subheading !== undefined) doc.subheading = dto.subheading.trim();
    if (dto.offerTitle !== undefined) doc.offerTitle = dto.offerTitle.trim();
    if (dto.offerText !== undefined) doc.offerText = dto.offerText.trim();
    if (dto.heroNoteTitle !== undefined) doc.heroNoteTitle = dto.heroNoteTitle.trim();
    if (dto.heroNoteText !== undefined) doc.heroNoteText = dto.heroNoteText.trim();
    if (dto.heroNoteSubtext !== undefined) {
      doc.heroNoteSubtext = dto.heroNoteSubtext.trim();
    }

    if (dto.introSection !== undefined) {
      if (dto.introSection.title !== undefined) {
        doc.introSection.title = dto.introSection.title.trim();
      }
      if (dto.introSection.paragraphs !== undefined) {
        doc.introSection.paragraphs = dto.introSection.paragraphs
          .map((p) => p.trim())
          .filter(Boolean);
      }
    }

    if (dto.guideSection !== undefined) {
      if (dto.guideSection.title !== undefined) {
        doc.guideSection.title = dto.guideSection.title.trim();
      }
      if (dto.guideSection.steps !== undefined) {
        doc.guideSection.steps = dto.guideSection.steps.map((step, index) => ({
          number: step.number?.trim() || String(index + 1).padStart(2, '0'),
          title: step.title?.trim() ?? '',
          body: step.body?.trim() ?? '',
        }));
      }
    }

    if (dto.packages !== undefined) {
      doc.packages = dto.packages.map((pkg, index) => ({
        id: pkg.id?.trim() || `package-${index + 1}`,
        name: pkg.name?.trim() ?? '',
        subtitle: pkg.subtitle?.trim() ?? '',
        price: Math.max(0, Number(pkg.price ?? 0)),
        currency: pkg.currency?.trim() || 'BDT',
        priceLabel: pkg.priceLabel?.trim() ?? '',
        badge: pkg.badge?.trim() ?? '',
        highlighted: Boolean(pkg.highlighted),
        featuresHeading: pkg.featuresHeading?.trim() || 'All features',
        features: (pkg.features ?? [])
          .map((feature) => feature.trim())
          .filter(Boolean),
        ctaLabel: pkg.ctaLabel?.trim() || 'Get Started',
        ctaHref: pkg.ctaHref?.trim() || '/support',
        enabled: pkg.enabled !== false,
        sortOrder:
          typeof pkg.sortOrder === 'number' ? pkg.sortOrder : index,
      }));
    }

    await doc.save();
    return doc;
  }

  private async getOrCreate(): Promise<WebsiteSettingsDocument> {
    let doc = await this.model.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.model.create({
        key: SETTINGS_KEY,
        introSection: DEFAULT_INTRO,
        guideSection: DEFAULT_GUIDE,
        packages: DEFAULT_PACKAGES,
      });
    } else {
      let needsSave = false;
      if (!doc.introSection?.paragraphs?.length) {
        doc.introSection = DEFAULT_INTRO;
        needsSave = true;
      }
      if (!doc.guideSection?.steps?.length) {
        doc.guideSection = DEFAULT_GUIDE;
        needsSave = true;
      }
      if (!doc.packages?.length) {
        doc.packages = DEFAULT_PACKAGES;
        needsSave = true;
      }
      if (
        LEGACY_OFFER_MARKERS.some((marker) =>
          doc?.offerText?.includes(marker),
        )
      ) {
        doc.offerText = DEFAULT_OFFER_TEXT;
        needsSave = true;
      }
      if (doc.heading?.trim() === 'Website Packages') {
        doc.heading = DEFAULT_HERO_HEADING;
        needsSave = true;
      }
      if (
        doc.subheading?.includes('Professional PHP/Laravel') ||
        doc.subheading?.includes('tailored for your business')
      ) {
        doc.subheading = DEFAULT_HERO_SUBHEADING;
        needsSave = true;
      }
      if (doc.heroNoteText?.includes(HERO_NOTE_SPLIT_MARKER)) {
        const splitAt = doc.heroNoteText.indexOf(HERO_NOTE_SPLIT_MARKER);
        const trailing = doc.heroNoteText.slice(splitAt + 2).trim();
        if (!doc.heroNoteSubtext?.trim()) {
          doc.heroNoteSubtext = trailing;
        }
        doc.heroNoteText = doc.heroNoteText.slice(0, splitAt + 1).trim();
        needsSave = true;
      }
      const step03 = doc.guideSection?.steps?.[2];
      if (
        step03 &&
        LEGACY_GUIDE_STEP_03_MARKERS.some(
          (marker) =>
            step03.title?.includes(marker) || step03.body?.includes(marker),
        )
      ) {
        doc.guideSection.steps[2] = { ...DEFAULT_GUIDE_STEP_03 };
        needsSave = true;
      }
      const introPara0 = doc.introSection?.paragraphs?.[0];
      if (introPara0?.includes('PHP/Laravel')) {
        doc.introSection.paragraphs[0] = introPara0.replace(
          'PHP/Laravel ',
          '',
        );
        needsSave = true;
      }
      const packageFootnoteMigrations: Array<{
        match: (pkg: WebsitePricingPackageDoc) => boolean;
        footnote: string;
      }> = [
        {
          match: (pkg) =>
            pkg.id === 'starter' ||
            pkg.name?.trim().toLowerCase() === 'starter',
          footnote: 'Website Suitable for Small Business',
        },
        {
          match: (pkg) =>
            pkg.id === 'business' ||
            pkg.name?.trim().toLowerCase() === 'business',
          footnote: 'Website Suitable for Medium Company',
        },
        {
          match: (pkg) =>
            pkg.id === 'enterprise' ||
            pkg.name?.trim().toLowerCase() === 'enterprise',
          footnote: 'Website Suitable for Large Company',
        },
      ];

      for (const migration of packageFootnoteMigrations) {
        const targetPkg = doc.packages?.find(migration.match);
        if (
          targetPkg &&
          (targetPkg.subtitle?.includes('PHP/Laravel') ||
            targetPkg.subtitle?.includes('Frontend:') ||
            targetPkg.subtitle?.includes('Backend:'))
        ) {
          targetPkg.subtitle = migration.footnote;
          needsSave = true;
        }
      }
      if (needsSave) {
        await doc.save();
      }
    }
    return doc;
  }
}
