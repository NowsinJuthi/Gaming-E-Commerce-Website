import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Absolute http(s) URLs or site-relative paths. Protocol-relative `//host` is rejected. */
const MENU_HREF_PATTERN = /^https?:\/\/[^\s/][^\s]*$|^\/(?!\/)[^\s]*$/;

/** Absolute http(s) URLs or site-relative paths. Protocol-relative `//host` is rejected. */
const LOGO_URL_PATTERN = /^https?:\/\/[^\s/][^\s]*$|^\/(?!\/).+/;

class SiteMenuLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(MENU_HREF_PATTERN)
  href!: string;
}

class SiteFooterColumnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SiteMenuLinkDto)
  items!: SiteMenuLinkDto[];
}

class SiteMenusDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SiteMenuLinkDto)
  header?: SiteMenuLinkDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SiteMenuLinkDto)
  headerOthers?: SiteMenuLinkDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SiteFooterColumnDto)
  footer?: SiteFooterColumnDto[];
}

class HomepageSlideDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(LOGO_URL_PATTERN)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: HomepageSlideDto) => Boolean(o.href?.trim()))
  @Matches(MENU_HREF_PATTERN)
  href?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

class NavItemDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class NavDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  home?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  categories?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  products?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  blog?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  blog_overview?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  blog_create?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  blog_categories?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  cart?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  checkout?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  wallet?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  orders?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  movie_subscription?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  downloads?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  wishlist?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  referral?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  affiliate?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  rewards?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  support?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  chat?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  email_support?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  tickets?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  notifications?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  settings?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  profile?: NavItemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavItemDto)
  reseller?: NavItemDto;
}

class RewardsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  pointsPerCurrency?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  redeemThreshold?: number;
}

class CheckoutDto {
  @IsOptional()
  @IsBoolean()
  walletEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  gatewayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  manualEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gatewayLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  gatewaySubtitle?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsIn(['wallet', 'gateway', 'manual'], { each: true })
  paymentMethodOrder?: Array<'wallet' | 'gateway' | 'manual'>;

  @IsOptional()
  @IsBoolean()
  allowGuestCheckout?: boolean;

  @IsOptional()
  @IsBoolean()
  allowGuestChat?: boolean;
}

class ChatDto {
  @IsOptional()
  @IsBoolean()
  allowImageUpload?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  averageResponseTime?: string;
}

class StorefrontDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  siteName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  defaultCurrency?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}

class PaletteColorsDto {
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  bg?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  elevated?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  muted?: string;
}

class AppearanceDto {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  defaultTheme?: string;

  @IsOptional()
  @IsIn(['indigo', 'violet', 'cyan', 'emerald', 'rose'])
  accent?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  brandColor?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaletteColorsDto)
  dark?: PaletteColorsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaletteColorsDto)
  light?: PaletteColorsDto;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: AppearanceDto) => Boolean(o.logoUrl))
  @Matches(LOGO_URL_PATTERN)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: AppearanceDto) => Boolean(o.logoUrlLight))
  @Matches(LOGO_URL_PATTERN)
  logoUrlLight?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: AppearanceDto) => Boolean(o.logoUrlDark))
  @Matches(LOGO_URL_PATTERN)
  logoUrlDark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: AppearanceDto) => Boolean(o.logoUrlAdmin))
  @Matches(LOGO_URL_PATTERN)
  logoUrlAdmin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: AppearanceDto) => Boolean(o.logoUrlFooter))
  @Matches(LOGO_URL_PATTERN)
  logoUrlFooter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: AppearanceDto) => Boolean(o.logoUrlFooterLight))
  @Matches(LOGO_URL_PATTERN)
  logoUrlFooterLight?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: AppearanceDto) => Boolean(o.logoUrlFooterDark))
  @Matches(LOGO_URL_PATTERN)
  logoUrlFooterDark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  logoAlt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  siteName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o: AppearanceDto) => Boolean(o.adminFaviconUrl))
  @Matches(LOGO_URL_PATTERN)
  adminFaviconUrl?: string;
}

export class UpdateCustomerPanelSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => StorefrontDto)
  storefront?: StorefrontDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NavDto)
  nav?: NavDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RewardsDto)
  rewards?: RewardsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutDto)
  checkout?: CheckoutDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatDto)
  chat?: ChatDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppearanceDto)
  appearance?: AppearanceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SiteMenusDto)
  siteMenus?: SiteMenusDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => HomepageSlideDto)
  homepageSlides?: HomepageSlideDto[];

  @IsOptional()
  @IsBoolean()
  homepageFeaturedOnly?: boolean;
}
