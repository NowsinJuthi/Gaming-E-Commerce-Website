import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CustomerPanelSettingsDocument =
  HydratedDocument<CustomerPanelSettings>;

@Schema({ _id: false })
export class SiteMenuLinkDoc {
  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({ required: true, trim: true })
  href!: string;
}

@Schema({ _id: false })
export class SiteFooterColumnDoc {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: [SiteMenuLinkDoc], default: [] })
  items!: SiteMenuLinkDoc[];
}

@Schema({ _id: false })
export class HomepageSlideDoc {
  @Prop({ required: true, trim: true })
  imageUrl!: string;

  @Prop({ default: '', trim: true, maxlength: 160 })
  alt!: string;

  @Prop({ default: '', trim: true, maxlength: 2048 })
  href!: string;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;
}

@Schema({ _id: false })
export class SiteMenusDoc {
  @Prop({ type: [SiteMenuLinkDoc], default: [] })
  header!: SiteMenuLinkDoc[];

  @Prop({ type: [SiteMenuLinkDoc], default: [] })
  headerOthers!: SiteMenuLinkDoc[];

  @Prop({ type: [SiteFooterColumnDoc], default: [] })
  footer!: SiteFooterColumnDoc[];
}

@Schema({ _id: false })
export class NavItemSettings {
  @Prop({ default: true })
  enabled!: boolean;
}

@Schema({ _id: false })
export class CustomerNavSettings {
  @Prop({ type: NavItemSettings, default: () => ({}) })
  home!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  categories!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  products!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  blog!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  blog_overview!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  blog_create!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  blog_categories!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  blog_settings!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  cart!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  checkout!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  wallet!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  orders!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({ enabled: false }) })
  downloads!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  wishlist!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({ enabled: false }) })
  referral!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({ enabled: false }) })
  affiliate!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({ enabled: false }) })
  rewards!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({ enabled: false }) })
  support!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  chat!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  email_support!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  tickets!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  notifications!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({ enabled: false }) })
  settings!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({}) })
  profile!: NavItemSettings;

  @Prop({ type: NavItemSettings, default: () => ({ enabled: false }) })
  reseller!: NavItemSettings;
}

@Schema({ _id: false })
export class RewardsSettingsDoc {
  @Prop({ default: true })
  enabled!: boolean;

  /** Points earned per 1 unit of order currency (e.g. 1 point per BDT). */
  @Prop({ default: 1 })
  pointsPerCurrency!: number;

  @Prop({ default: 100 })
  redeemThreshold!: number;
}

@Schema({ _id: false })
export class ChatSettingsDoc {
  /** When false, live chat cannot send picture attachments. */
  @Prop({ default: true })
  allowImageUpload!: boolean;

  /** Shown in live chat header, e.g. "< 15 minutes". */
  @Prop({ default: '< 15 minutes', trim: true, maxlength: 80 })
  averageResponseTime!: string;
}

@Schema({ _id: false })
export class CheckoutSettingsDoc {
  @Prop({ default: true })
  walletEnabled!: boolean;

  @Prop({ default: true })
  gatewayEnabled!: boolean;

  @Prop({ default: true })
  manualEnabled!: boolean;

  /** Storefront checkout label for MFS / gateway payment (e.g. bKash / Nagad). */
  @Prop({ default: 'bKash / Nagad', trim: true, maxlength: 80 })
  gatewayLabel!: string;

  /** Short description under the gateway payment option. */
  @Prop({ default: 'Pay Money And Verify With TrxID', trim: true, maxlength: 160 })
  gatewaySubtitle!: string;

  /** Display order on checkout: wallet, gateway, manual. */
  @Prop({
    type: [String],
    default: () => ['wallet', 'gateway', 'manual'],
  })
  paymentMethodOrder!: string[];

  /** When true, customers can add to cart and checkout without registering. */
  @Prop({ default: false })
  allowGuestCheckout!: boolean;

  /** When true, anonymous visitors can open a live-chat session without logging in. */
  @Prop({ default: false })
  allowGuestChat!: boolean;
}

@Schema({ _id: false })
export class StorefrontSettingsDoc {
  @Prop({ default: 'UniQbd' })
  siteName!: string;

  @Prop({ default: 'BDT' })
  defaultCurrency!: string;

  @Prop({ default: false })
  maintenanceMode!: boolean;
}

@Schema({ _id: false })
export class PaletteColorsDoc {
  @Prop()
  bg!: string;

  @Prop()
  elevated!: string;

  @Prop()
  muted!: string;
}

@Schema({ _id: false })
export class AppearanceSettingsDoc {
  @Prop({ default: 'system' })
  defaultTheme!: string;

  /** Set when an admin explicitly saves defaultTheme (keeps Dark if chosen). */
  @Prop({ default: false })
  defaultThemeExplicit!: boolean;

  @Prop({ default: 'emerald' })
  accent!: string;

  @Prop({ default: '#26BFB0' })
  brandColor!: string;

  @Prop({ type: PaletteColorsDoc, default: () => ({}) })
  dark!: PaletteColorsDoc;

  @Prop({ type: PaletteColorsDoc, default: () => ({}) })
  light!: PaletteColorsDoc;

  /** @deprecated Legacy single logo — falls back when theme logos are empty. */
  @Prop({ default: '' })
  logoUrl!: string;

  /** Empty = text logo for light theme visitors. */
  @Prop({ default: '' })
  logoUrlLight!: string;

  /** Empty = text logo for dark / gaming / amoled themes. */
  @Prop({ default: '' })
  logoUrlDark!: string;

  /** Empty = use dark site logo in admin header. */
  @Prop({ default: '' })
  logoUrlAdmin!: string;

  /** @deprecated Legacy single footer logo — falls back when theme logos are empty. */
  @Prop({ default: '' })
  logoUrlFooter!: string;

  /** Empty = use light site logo in storefront footer (light theme). */
  @Prop({ default: '' })
  logoUrlFooterLight!: string;

  /** Empty = use dark site logo in storefront footer (dark theme). */
  @Prop({ default: '' })
  logoUrlFooterDark!: string;

  @Prop({ default: 'UniQbd' })
  logoAlt!: string;

  @Prop({ default: 'UniQbd' })
  siteName!: string;

  /** Empty = default admin dashboard favicon (/icon). */
  @Prop({ default: '' })
  adminFaviconUrl!: string;
}

@Schema({
  timestamps: true,
  collection: 'customer_panel_settings',
})
export class CustomerPanelSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ type: StorefrontSettingsDoc, default: () => ({}) })
  storefront!: StorefrontSettingsDoc;

  @Prop({ type: CustomerNavSettings, default: () => ({}) })
  nav!: CustomerNavSettings;

  @Prop({ type: RewardsSettingsDoc, default: () => ({}) })
  rewards!: RewardsSettingsDoc;

  @Prop({ type: CheckoutSettingsDoc, default: () => ({}) })
  checkout!: CheckoutSettingsDoc;

  @Prop({ type: ChatSettingsDoc, default: () => ({}) })
  chat!: ChatSettingsDoc;

  @Prop({ type: AppearanceSettingsDoc, default: () => ({}) })
  appearance!: AppearanceSettingsDoc;

  @Prop({ type: SiteMenusDoc, default: () => ({}) })
  siteMenus!: SiteMenusDoc;

  @Prop({ type: [HomepageSlideDoc], default: [] })
  homepageSlides!: HomepageSlideDoc[];

  /** When true, only products marked `featured: true` appear in homepage category sections. */
  @Prop({ default: false })
  homepageFeaturedOnly!: boolean;

  /** One-time migration: optional nav items default off unless admin enables them. */
  @Prop({ default: false })
  navOffDefaultsApplied!: boolean;

  /** One-time migration: support nav off by default (admin can enable). */
  @Prop({ default: false })
  navSupportOffDefaultApplied!: boolean;

  /** One-time migration: settings nav off by default (managed under Profile). */
  @Prop({ default: false })
  navSettingsOffDefaultApplied!: boolean;

  updatedAt?: Date;
}

export const CustomerPanelSettingsSchema = SchemaFactory.createForClass(
  CustomerPanelSettings,
);
