import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CustomerPanelSettings,
  CustomerPanelSettingsDocument,
} from '../../database/schemas/customer-panel-settings.schema';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import { EventsService } from '../../shared/events/events.service';
import { AppEvent } from '../../shared/events/events.types';
import { UpdateCustomerPanelSettingsDto } from './dto/update-customer-panel-settings.dto';
import { deepReplaceLegacyBrand } from '../../common/utils/legacy-brand-migration';
import { LICENSE_FEATURE_LABELS } from '../license/license.constants';
import { LicenseService } from '../license/license.service';

const SETTINGS_KEY = 'global';

/** Customer nav items hidden until enabled in admin (Customer panel → Navigation). */
export const NAV_OFF_BY_DEFAULT = [
  'downloads',
  'referral',
  'affiliate',
  'rewards',
  'reseller',
  'support',
  'settings',
] as const;

const NAV_OFF_BY_DEFAULT_SET = new Set<string>(NAV_OFF_BY_DEFAULT);

export function defaultNavItemEnabled(key: string): boolean {
  return !NAV_OFF_BY_DEFAULT_SET.has(key);
}

export function resolveNavItemEnabled(
  key: string,
  enabled: boolean | undefined,
): boolean {
  if (enabled !== undefined) return enabled;
  return defaultNavItemEnabled(key);
}

export const UNIQBD_LOGO_PATH = '/logo/uniqbd-logo-dark.png';
export const UNIQBD_LOGO_LIGHT_PATH = '/logo/uniqbd-logo-light.png';

export interface SiteMenuLink {
  label: string;
  href: string;
}

export interface SiteFooterColumn {
  title: string;
  items: SiteMenuLink[];
}

export interface SiteMenusConfig {
  header: SiteMenuLink[];
  headerOthers: SiteMenuLink[];
  footer: SiteFooterColumn[];
}

export const DEFAULT_HEADER_OTHERS_ITEMS: SiteMenuLink[] = [
  { label: 'Product Requests', href: '/request-product' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'Blog', href: '/blog' },
  { label: 'Website', href: '/website' },
];

export const DEFAULT_SITE_MENUS: SiteMenusConfig = {
  header: [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/products' },
    { label: 'Contact us', href: '/contact' },
  ],
  headerOthers: DEFAULT_HEADER_OTHERS_ITEMS,
  footer: [
    {
      title: 'Footer Menu',
      items: [
        { label: 'Product Requests', href: '/request-product' },
        { label: 'All products', href: '/products' },
        { label: 'Blog', href: '/blog' },
        { label: 'Gaming', href: '/products?type=topup' },
        { label: 'Streaming', href: '/products?type=giftcard' },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Sign in', href: '/login' },
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'My gift cards', href: '/orders' },
      ],
    },
    {
      title: 'Useful Links',
      items: [
        { label: 'About UniQbd', href: '/about' },
        { label: 'Contact us', href: '/contact' },
      ],
    },
  ],
};

export interface HomepageSlide {
  imageUrl: string;
  alt: string;
  href: string;
  enabled: boolean;
  sortOrder: number;
}

export const DEFAULT_SITE_APPEARANCE: SiteAppearanceConfig = {
  defaultTheme: 'system',
  accent: 'emerald',
  brandColor: '#26BFB0',
  dark: { bg: '#01131a', elevated: '#031a22', muted: '#06212a' },
  light: { bg: '#f8fafc', elevated: '#ffffff', muted: '#f1f5f9' },
  logoUrlLight: UNIQBD_LOGO_LIGHT_PATH,
  logoUrlDark: UNIQBD_LOGO_PATH,
  logoUrlAdmin: '',
  logoUrlFooter: '',
  logoUrlFooterLight: '',
  logoUrlFooterDark: '',
  logoAlt: 'UniQbd',
  siteName: 'UniQbd',
  adminFaviconUrl: '',
};

export interface PaletteColors {
  bg: string;
  elevated: string;
  muted: string;
}

export interface SiteAppearanceConfig {
  defaultTheme: string;
  accent: string;
  brandColor: string;
  dark: PaletteColors;
  light: PaletteColors;
  logoUrlLight: string;
  logoUrlDark: string;
  logoUrlAdmin: string;
  logoUrlFooter: string;
  logoUrlFooterLight: string;
  logoUrlFooterDark: string;
  logoAlt: string;
  siteName: string;
  adminFaviconUrl: string;
}

export interface CustomerPanelConfig {
  storefront: {
    siteName: string;
    defaultCurrency: string;
    maintenanceMode: boolean;
  };
  nav: Record<string, boolean>;
  rewards: {
    enabled: boolean;
    pointsPerCurrency: number;
    redeemThreshold: number;
  };
  checkout: {
    walletEnabled: boolean;
    gatewayEnabled: boolean;
    manualEnabled: boolean;
    gatewayLabel: string;
    gatewaySubtitle: string;
    paymentMethodOrder: Array<'wallet' | 'gateway' | 'manual'>;
    allowGuestCheckout: boolean;
    /** When true, anonymous visitors can start a live-chat without logging in. */
    allowGuestChat: boolean;
  };
  chat: {
    /** When false, picture uploads are blocked in live chat. */
    allowImageUpload: boolean;
    /** Shown in live chat header after "Average Response Time:" */
    averageResponseTime: string;
  };
  appearance: SiteAppearanceConfig;
  siteMenus: SiteMenusConfig;
  homepageSlides: HomepageSlide[];
  /** When true, only featured products appear in homepage category sections. */
  homepageFeaturedOnly: boolean;
}

const DEFAULT_PAYMENT_METHOD_ORDER = ['wallet', 'gateway', 'manual'] as const;

function normalizePaymentMethodOrder(
  order?: string[] | null,
): Array<'wallet' | 'gateway' | 'manual'> {
  const allowed = new Set<string>(DEFAULT_PAYMENT_METHOD_ORDER);
  const seen = new Set<string>();
  const normalized: Array<'wallet' | 'gateway' | 'manual'> = [];

  for (const value of order ?? []) {
    if (!allowed.has(value) || seen.has(value)) continue;
    normalized.push(value as 'wallet' | 'gateway' | 'manual');
    seen.add(value);
  }

  for (const value of DEFAULT_PAYMENT_METHOD_ORDER) {
    if (!seen.has(value)) {
      normalized.push(value);
    }
  }

  return normalized;
}

@Injectable()
export class CustomerPanelSettingsService implements OnModuleInit {
  private readonly logger = new Logger(CustomerPanelSettingsService.name);

  constructor(
    @InjectModel(CustomerPanelSettings.name)
    private readonly settingsModel: Model<CustomerPanelSettingsDocument>,
    private readonly events: EventsService,
    private readonly cacheService: CacheService,
    private readonly license: LicenseService,
  ) {}

  /** Replace leftover legacy branding in stored panel settings on startup. */
  async onModuleInit(): Promise<void> {
    try {
      const doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
      if (!doc) return;

      let dirty = false;
      const paths = [
        'appearance',
        'storefront',
        'siteMenus',
        'homepageSlides',
        'checkout',
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
        this.logger.log('Migrated legacy brand text to UniQbd in customer panel settings');
      }
    } catch (err) {
      this.logger.warn('Could not run legacy brand migration in customer panel settings', err);
    }
  }

  async invalidateCache(): Promise<void> {
    await this.cacheService.del(CacheKeys.settings.panel);
  }

  async getConfig(): Promise<CustomerPanelConfig> {
    const cached = await this.cacheService.getJson<CustomerPanelConfig>(CacheKeys.settings.panel);
    if (cached) return cached;
    const doc = await this.getOrCreate();
    const config = this.toConfig(doc);
    await this.cacheService.setJson(CacheKeys.settings.panel, config, CacheKeys.ttl.settingsPanel);
    return config;
  }

  async getSettings(): Promise<CustomerPanelSettingsDocument> {
    return this.getOrCreate();
  }

  async updateSettings(dto: UpdateCustomerPanelSettingsDto) {
    await this.assertLiveChatFeatureForUpdate(dto);
    const doc = await this.getOrCreate();
    if (dto.rewards) {
      Object.assign(doc.rewards, dto.rewards);
      doc.markModified('rewards');
    }
    if (dto.checkout) {
      if (!doc.checkout) {
        doc.checkout = {} as typeof doc.checkout;
      }
      const checkout = dto.checkout;
      if (checkout.walletEnabled !== undefined) {
        doc.checkout.walletEnabled = checkout.walletEnabled;
      }
      if (checkout.gatewayEnabled !== undefined) {
        doc.checkout.gatewayEnabled = checkout.gatewayEnabled;
      }
      if (checkout.manualEnabled !== undefined) {
        doc.checkout.manualEnabled = checkout.manualEnabled;
      }
      if (checkout.gatewayLabel !== undefined) {
        doc.checkout.gatewayLabel = checkout.gatewayLabel;
      }
      if (checkout.gatewaySubtitle !== undefined) {
        doc.checkout.gatewaySubtitle = checkout.gatewaySubtitle;
      }
      if (checkout.paymentMethodOrder !== undefined) {
        doc.checkout.paymentMethodOrder = checkout.paymentMethodOrder;
      }
      if (checkout.allowGuestCheckout !== undefined) {
        doc.checkout.allowGuestCheckout = checkout.allowGuestCheckout;
      }
      if ((checkout as { allowGuestChat?: boolean }).allowGuestChat !== undefined) {
        doc.checkout.allowGuestChat = (checkout as { allowGuestChat?: boolean }).allowGuestChat!;
      }
      doc.markModified('checkout');
    }
    if (dto.chat) {
      if (!doc.chat) {
        doc.chat = {} as typeof doc.chat;
      }
      if (dto.chat.allowImageUpload !== undefined) {
        doc.chat.allowImageUpload = dto.chat.allowImageUpload;
      }
      if (dto.chat.averageResponseTime !== undefined) {
        doc.chat.averageResponseTime =
          dto.chat.averageResponseTime.trim() || '< 15 minutes';
      }
      doc.markModified('chat');
    }
    if (dto.storefront) {
      Object.assign(doc.storefront, dto.storefront);
      doc.markModified('storefront');
    }
    if (dto.appearance) {
      if (dto.appearance.defaultTheme !== undefined) {
        doc.appearance.defaultTheme = dto.appearance.defaultTheme;
        doc.appearance.defaultThemeExplicit = true;
      }
      if (dto.appearance.accent !== undefined) {
        doc.appearance.accent = dto.appearance.accent;
      }
      if (dto.appearance.brandColor !== undefined) {
        doc.appearance.brandColor = dto.appearance.brandColor;
      }
      if (dto.appearance.dark) {
        Object.assign(doc.appearance.dark, dto.appearance.dark);
      }
      if (dto.appearance.light) {
        Object.assign(doc.appearance.light, dto.appearance.light);
      }
      if (dto.appearance.logoUrl !== undefined) {
        doc.appearance.logoUrl = dto.appearance.logoUrl;
      }
      if (dto.appearance.logoUrlLight !== undefined) {
        doc.appearance.logoUrlLight = dto.appearance.logoUrlLight;
      }
      if (dto.appearance.logoUrlDark !== undefined) {
        doc.appearance.logoUrlDark = dto.appearance.logoUrlDark;
      }
      if (dto.appearance.logoUrlAdmin !== undefined) {
        doc.appearance.logoUrlAdmin = dto.appearance.logoUrlAdmin;
      }
      if (dto.appearance.logoUrlFooter !== undefined) {
        doc.appearance.logoUrlFooter = dto.appearance.logoUrlFooter;
      }
      if (dto.appearance.logoUrlFooterLight !== undefined) {
        doc.appearance.logoUrlFooterLight = dto.appearance.logoUrlFooterLight;
      }
      if (dto.appearance.logoUrlFooterDark !== undefined) {
        doc.appearance.logoUrlFooterDark = dto.appearance.logoUrlFooterDark;
      }
      if (dto.appearance.logoAlt !== undefined) {
        doc.appearance.logoAlt = dto.appearance.logoAlt;
      }
      if (dto.appearance.siteName !== undefined) {
        doc.appearance.siteName = dto.appearance.siteName;
      }
      if (dto.appearance.adminFaviconUrl !== undefined) {
        doc.appearance.adminFaviconUrl = dto.appearance.adminFaviconUrl;
      }
      doc.markModified('appearance');
    }
    if (dto.nav) {
      if (!doc.nav) {
        doc.nav = {} as CustomerPanelSettingsDocument['nav'];
      }
      for (const [key, value] of Object.entries(dto.nav)) {
        if (!value || typeof value !== 'object') continue;
        const navKey = key as keyof typeof doc.nav;
        if (!doc.nav[navKey]) {
          doc.nav[navKey] = {
            enabled:
              value.enabled !== undefined
                ? value.enabled
                : defaultNavItemEnabled(key),
          };
        } else if (value.enabled !== undefined) {
          doc.nav[navKey].enabled = value.enabled;
        }
      }
      doc.markModified('nav');
    }
    if (dto.siteMenus) {
      if (!doc.siteMenus) {
        doc.siteMenus = { header: [], headerOthers: [], footer: [] };
      }
      if (dto.siteMenus.header) {
        doc.siteMenus.header = dto.siteMenus.header.map((item) => ({
          label: item.label.trim(),
          href: item.href.trim(),
        }));
      }
      if (dto.siteMenus.headerOthers) {
        doc.siteMenus.headerOthers = dto.siteMenus.headerOthers.map((item) => ({
          label: item.label.trim(),
          href: item.href.trim(),
        }));
      }
      if (dto.siteMenus.footer) {
        doc.siteMenus.footer = dto.siteMenus.footer.map((column) => ({
          title: column.title.trim(),
          items: (column.items ?? []).map((item) => ({
            label: item.label.trim(),
            href: item.href.trim(),
          })),
        }));
      }
      doc.markModified('siteMenus');
    }
    const bannersChanged = !!dto.homepageSlides;
    if (bannersChanged) {
      doc.homepageSlides = dto.homepageSlides!.map((slide, index) => ({
        imageUrl: slide.imageUrl.trim(),
        alt: slide.alt?.trim() ?? '',
        href: slide.href?.trim() ?? '',
        enabled: slide.enabled ?? true,
        sortOrder: slide.sortOrder ?? index,
      }));
      doc.markModified('homepageSlides');
    }
    if (typeof dto.homepageFeaturedOnly === 'boolean') {
      doc.homepageFeaturedOnly = dto.homepageFeaturedOnly;
      await this.cacheService.delByPrefix(CacheKeys.product.homepageSectionsPrefix);
    }
    await doc.save();
    await this.invalidateCache();

    // Determine which section changed for granular cache invalidation on clients.
    const section = bannersChanged
      ? 'banners'
      : dto.storefront
        ? 'storefront'
        : dto.checkout
          ? 'checkout'
          : dto.appearance
            ? 'appearance'
            : dto.nav
              ? 'nav'
              : dto.siteMenus
                ? 'siteMenus'
                : dto.rewards
                  ? 'rewards'
                  : undefined;

    if (bannersChanged) {
      this.events.emit(AppEvent.BannerUpdated, {});
    }
    this.events.emit(AppEvent.SettingsUpdated, { section });

    return this.getOrCreate();
  }

  private async assertLiveChatFeatureForUpdate(
    dto: UpdateCustomerPanelSettingsDto,
  ): Promise<void> {
    const touchesLiveChat =
      Boolean(dto.chat) ||
      dto.nav?.chat !== undefined ||
      (dto.checkout as { allowGuestChat?: boolean } | undefined)
        ?.allowGuestChat !== undefined;
    if (!touchesLiveChat) {
      return;
    }
    if (!(await this.license.hasFeature('liveChat'))) {
      throw new ForbiddenException(
        `License feature "${LICENSE_FEATURE_LABELS.liveChat}" is not enabled for this installation.`,
      );
    }
  }

  private async getOrCreate(): Promise<CustomerPanelSettingsDocument> {
    let doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.settingsModel.create({
        key: SETTINGS_KEY,
        navOffDefaultsApplied: true,
        navSupportOffDefaultApplied: true,
      });
      return doc;
    }

    if (!doc.navOffDefaultsApplied) {
      const stillAllOptionalOn = NAV_OFF_BY_DEFAULT.every(
        (key) => doc.nav?.[key]?.enabled !== false,
      );
      if (stillAllOptionalOn) {
        for (const key of NAV_OFF_BY_DEFAULT) {
          if (doc.nav?.[key]) {
            doc.nav[key].enabled = false;
          }
        }
        doc.markModified('nav');
      }
      doc.navOffDefaultsApplied = true;
      await doc.save();
      await this.invalidateCache();
    }

    if (!doc.navSupportOffDefaultApplied) {
      if (doc.nav?.support) {
        doc.nav.support.enabled = false;
        doc.markModified('nav');
      }
      doc.navSupportOffDefaultApplied = true;
      await doc.save();
      await this.invalidateCache();
    }

    if (!doc.navSettingsOffDefaultApplied) {
      if (doc.nav?.settings) {
        doc.nav.settings.enabled = false;
        doc.markModified('nav');
      }
      doc.navSettingsOffDefaultApplied = true;
      await doc.save();
      await this.invalidateCache();
    }

    if (
      doc.appearance?.defaultTheme === 'dark' &&
      !doc.appearance?.defaultThemeExplicit
    ) {
      doc.appearance.defaultTheme = DEFAULT_SITE_APPEARANCE.defaultTheme;
      await doc.save();
      await this.invalidateCache();
    }

    return doc;
  }

  private toConfig(doc: CustomerPanelSettingsDocument): CustomerPanelConfig {
    const navKeys = [
      'home',
      'categories',
      'products',
      'blog_overview',
      'blog',
      'blog_create',
      'blog_categories',
      'cart',
      'checkout',
      'wallet',
      'orders',
      'downloads',
      'wishlist',
      'referral',
      'affiliate',
      'rewards',
      'support',
      'chat',
      'email_support',
      'tickets',
      'notifications',
      'settings',
      'profile',
      'reseller',
    ] as const;

    const nav: Record<string, boolean> = {};
    for (const key of navKeys) {
      nav[key] =
        key === 'settings'
          ? false
          : resolveNavItemEnabled(key, doc.nav?.[key]?.enabled);
    }

    return {
      storefront: {
        siteName: doc.storefront?.siteName ?? 'UniQbd',
        defaultCurrency: doc.storefront?.defaultCurrency ?? 'BDT',
        maintenanceMode: doc.storefront?.maintenanceMode ?? false,
      },
      nav,
      rewards: {
        enabled: doc.rewards?.enabled ?? true,
        pointsPerCurrency: doc.rewards?.pointsPerCurrency ?? 1,
        redeemThreshold: doc.rewards?.redeemThreshold ?? 100,
      },
      checkout: {
        walletEnabled: doc.checkout?.walletEnabled ?? true,
        gatewayEnabled: doc.checkout?.gatewayEnabled ?? true,
        manualEnabled: doc.checkout?.manualEnabled ?? true,
        gatewayLabel:
          doc.checkout?.gatewayLabel?.trim() || 'bKash / Nagad',
        gatewaySubtitle:
          doc.checkout?.gatewaySubtitle?.trim() ||
          'Pay Money And Verify With TrxID',
        paymentMethodOrder: normalizePaymentMethodOrder(
          doc.checkout?.paymentMethodOrder,
        ),
        allowGuestCheckout: doc.checkout?.allowGuestCheckout ?? false,
        allowGuestChat: doc.checkout?.allowGuestChat ?? false,
      },
      chat: {
        allowImageUpload: doc.chat?.allowImageUpload ?? true,
        averageResponseTime:
          doc.chat?.averageResponseTime?.trim() || '< 15 minutes',
      },
      appearance: this.normalizeAppearance(doc),
      siteMenus: this.normalizeSiteMenus(doc),
      homepageSlides: this.normalizeHomepageSlides(doc),
      homepageFeaturedOnly: doc.homepageFeaturedOnly ?? false,
    };
  }

  private normalizeHomepageSlides(
    doc: CustomerPanelSettingsDocument,
  ): HomepageSlide[] {
    return (doc.homepageSlides ?? [])
      .filter((slide) => slide.imageUrl?.trim())
      .map((slide, index) => ({
        imageUrl: slide.imageUrl.trim(),
        alt: slide.alt?.trim() ?? '',
        href: slide.href?.trim() ?? '',
        enabled: slide.enabled ?? true,
        sortOrder: slide.sortOrder ?? index,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private normalizeSiteMenus(
    doc: CustomerPanelSettingsDocument,
  ): SiteMenusConfig {
    const header = (doc.siteMenus?.header ?? [])
      .filter((item) => item.label?.trim() && item.href?.trim())
      .map((item) => ({
        label: item.label.trim(),
        href: item.href.trim(),
      }));
    const rawHeaderOthers = doc.siteMenus?.headerOthers;
    const headerOthers = (rawHeaderOthers ?? [])
      .filter((item) => item.label?.trim() && item.href?.trim())
      .map((item) => ({
        label: item.label.trim(),
        href: item.href.trim(),
      }));
    const footer = (doc.siteMenus?.footer ?? [])
      .filter((column) => column.title?.trim())
      .map((column) => ({
        title: column.title.trim(),
        items: (column.items ?? [])
          .filter((item) => item.label?.trim() && item.href?.trim())
          .map((item) => ({
            label: item.label.trim(),
            href: item.href.trim(),
          })),
      }))
      .filter((column) => column.items.length > 0);

    return {
      header: header.length > 0 ? header : DEFAULT_SITE_MENUS.header,
      headerOthers:
        rawHeaderOthers !== undefined
          ? headerOthers
          : DEFAULT_SITE_MENUS.headerOthers,
      footer: footer.length > 0 ? footer : DEFAULT_SITE_MENUS.footer,
    };
  }

  private normalizeAppearance(
    doc: CustomerPanelSettingsDocument,
  ): SiteAppearanceConfig {
    const d = DEFAULT_SITE_APPEARANCE;
    return {
      defaultTheme: doc.appearance?.defaultTheme ?? d.defaultTheme,
      accent: doc.appearance?.accent ?? d.accent,
      brandColor: doc.appearance?.brandColor ?? d.brandColor,
      dark: {
        bg: doc.appearance?.dark?.bg ?? d.dark.bg,
        elevated: doc.appearance?.dark?.elevated ?? d.dark.elevated,
        muted: doc.appearance?.dark?.muted ?? d.dark.muted,
      },
      light: {
        bg: doc.appearance?.light?.bg ?? d.light.bg,
        elevated: doc.appearance?.light?.elevated ?? d.light.elevated,
        muted: doc.appearance?.light?.muted ?? d.light.muted,
      },
      logoUrlLight:
        doc.appearance?.logoUrlLight ||
        doc.appearance?.logoUrl ||
        d.logoUrlLight,
      logoUrlDark:
        doc.appearance?.logoUrlDark ||
        doc.appearance?.logoUrl ||
        d.logoUrlDark,
      logoUrlAdmin: '',
      logoUrlFooter: '',
      logoUrlFooterLight: '',
      logoUrlFooterDark: '',
      logoAlt: doc.appearance?.logoAlt ?? d.logoAlt,
      siteName: doc.appearance?.siteName ?? d.siteName,
      adminFaviconUrl: doc.appearance?.adminFaviconUrl ?? d.adminFaviconUrl,
    };
  }
}
