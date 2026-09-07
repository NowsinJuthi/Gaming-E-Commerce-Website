import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailConfig } from '../../config/namespaces/mail.config';
import {
  EmailSettings,
  EmailSettingsDocument,
  SmtpProviderPreset,
} from '../../database/schemas/email-settings.schema';
import {
  SiteAppearanceConfig,
  CustomerPanelSettingsService,
} from '../../modules/customer-panel/customer-panel-settings.service';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { deepReplaceLegacyBrand } from '../../common/utils/legacy-brand-migration';
import { SMTP_PROVIDER_PRESETS } from './smtp-providers';
import { normalizeSmtpSecure } from './smtp-tls';

const SETTINGS_KEY = 'global';
const CACHE_MS = 30_000;

const DEFAULT_PRIMARY_COLOR = '#38bfb0';

export type EmailLogoSource = 'light' | 'dark' | 'system' | 'custom';

export type EmailSenderChannel =
  | 'default'
  | 'orders'
  | 'support'
  | 'system'
  | 'admin';

/** Env defaults merged with admin DB overrides — what templates/mailer consume. */
export interface EffectiveEmailSettings {
  enabled: boolean;
  mockMode: boolean;
  orderCustomerEmailsEnabled: boolean;
  adminOrderAlertEmailsEnabled: boolean;
  fromName: string;
  fromEmail: string;
  ordersFromName: string;
  ordersFromEmail: string;
  ordersReplyTo: string;
  supportFromName: string;
  supportFromEmail: string;
  supportReplyTo: string;
  systemFromName: string;
  systemFromEmail: string;
  systemReplyTo: string;
  adminFromName: string;
  adminFromEmail: string;
  adminReplyTo: string;
  replyTo?: string;
  emailLogoSource: EmailLogoSource;
  logoUrl: string;
  footerText: string;
  primaryColor: string;
  webUrl: string;
  /** API/public origin for uploaded assets (/api/uploads/...). */
  assetBaseUrl: string;
  apiGlobalPrefix: string;
}

export interface EffectiveSmtpConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  configured: boolean;
}

export interface EmailSettingsView {
  enabled: boolean;
  mockMode: boolean;
  orderCustomerEmailsEnabled: boolean;
  adminOrderAlertEmailsEnabled: boolean;
  fromName: string;
  fromEmail: string;
  ordersFromName: string;
  ordersFromEmail: string;
  ordersSmtpUser: string;
  ordersReplyTo: string;
  supportFromName: string;
  supportFromEmail: string;
  supportSmtpUser: string;
  supportReplyTo: string;
  systemFromName: string;
  systemFromEmail: string;
  systemSmtpUser: string;
  systemReplyTo: string;
  adminFromName: string;
  adminFromEmail: string;
  adminSmtpUser: string;
  adminReplyTo: string;
  replyTo: string;
  smtpProvider: SmtpProviderPreset;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  emailLogoSource: EmailLogoSource;
  logoUrl: string;
  footerText: string;
  primaryColor: string;
  updatedAt?: Date;
}

export interface EmailChannelSmtpStatus {
  hasPassword: boolean;
  usernameMasked: string;
}

export interface EmailSmtpAdminStatus {
  configured: boolean;
  hasPassword: boolean;
  host: string;
  port: number;
  secure: boolean;
  hasAuth: boolean;
  usernameMasked: string;
  fromDisplay: string;
  envFromName: string;
  envFromEmail: string;
  adminEmail: string;
  orders: EmailChannelSmtpStatus;
  support: EmailChannelSmtpStatus;
  system: EmailChannelSmtpStatus;
  admin: EmailChannelSmtpStatus;
}

@Injectable()
export class EmailSettingsService implements OnModuleInit {
  private readonly logger = new Logger(EmailSettingsService.name);
  private cache: { value: EffectiveEmailSettings; expires: number } | null =
    null;
  private smtpCache: { value: EffectiveSmtpConfig; expires: number } | null =
    null;

  constructor(
    @InjectModel(EmailSettings.name)
    private readonly settingsModel: Model<EmailSettingsDocument>,
    private readonly config: ConfigService,
    private readonly panelSettings: CustomerPanelSettingsService,
  ) {}

  /** Replace leftover legacy branding in stored email settings on startup. */
  async onModuleInit(): Promise<void> {
    try {
      await this.migrateLegacyBrandText();
      await this.seedEnvToDatabaseIfNeeded();
    } catch (err) {
      this.logger.warn('Could not initialize email settings persistence', err);
    }
  }

  private async migrateLegacyBrandText(): Promise<void> {
    const doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) return;

    let dirty = false;
    const plain = doc.toObject();
    for (const [key, val] of Object.entries(plain)) {
      if (key === '_id' || key === '__v') continue;
      const result = deepReplaceLegacyBrand(val);
      if (result.changed) {
        doc.set(key, result.value);
        dirty = true;
      }
    }

    if (!dirty) return;

    await doc.save();
    this.invalidateCache();
    this.logger.log('Migrated legacy brand text to UniQbd in email settings');
  }

  /** Copy .env SMTP values into MongoDB once so hosting changes do not reset mail. */
  private async seedEnvToDatabaseIfNeeded(): Promise<void> {
    const doc = await this.getOrCreateWithSecrets();
    if (doc.useDatabaseOnly) return;

    if (isEmailStoredInDatabase(doc)) {
      doc.useDatabaseOnly = true;
      await doc.save();
      this.invalidateCache();
      this.logger.log(
        'Email settings locked to MongoDB (existing email_settings document)',
      );
      return;
    }

    const env = this.mailEnv();
    if (!env.host && !env.user && !env.pass && !env.fromEmail) return;

    let dirty = false;
    if (env.host && !doc.smtpHost?.trim()) {
      doc.smtpHost = env.host;
      dirty = true;
    }
    if (env.port > 0 && doc.smtpPort <= 0) {
      doc.smtpPort = env.port;
      dirty = true;
    }
    if (dirty || env.host) {
      const port = doc.smtpPort > 0 ? doc.smtpPort : env.port;
      doc.smtpSecure = normalizeSmtpSecure(
        port,
        doc.smtpHost?.trim() ? doc.smtpSecure : env.secure,
      );
    }
    if (env.user && !doc.smtpUser?.trim()) {
      doc.smtpUser = env.user;
      dirty = true;
    }
    if (env.pass && !doc.smtpPass?.trim()) {
      doc.smtpPass = env.pass;
      dirty = true;
    }
    if (env.fromName && !doc.fromName?.trim()) {
      doc.fromName = env.fromName;
      dirty = true;
    }
    if (env.fromEmail && !doc.fromEmail?.trim()) {
      doc.fromEmail = env.fromEmail;
      dirty = true;
    }

    if (!dirty && !doc.smtpHost?.trim()) return;

    doc.useDatabaseOnly = true;
    await doc.save();
    this.invalidateCache();
    this.logger.log(
      'Seeded SMTP settings from environment into MongoDB (email_settings)',
    );
  }

  invalidateCache(): void {
    this.cache = null;
    this.smtpCache = null;
  }

  private mailEnv(): MailConfig {
    return this.config.getOrThrow<MailConfig>('mail');
  }

  /** Raw stored document (for the admin settings screen). */
  async getSettings(): Promise<EmailSettingsDocument> {
    return this.getOrCreate();
  }

  toSettingsView(doc: EmailSettingsDocument): EmailSettingsView {
    return {
      enabled: doc.enabled,
      mockMode: doc.mockMode,
      orderCustomerEmailsEnabled: doc.orderCustomerEmailsEnabled !== false,
      adminOrderAlertEmailsEnabled: doc.adminOrderAlertEmailsEnabled !== false,
      fromName: doc.fromName,
      fromEmail: doc.fromEmail,
      ordersFromName: doc.ordersFromName,
      ordersFromEmail: doc.ordersFromEmail,
      ordersSmtpUser: doc.ordersSmtpUser,
      ordersReplyTo: doc.ordersReplyTo,
      supportFromName: doc.supportFromName,
      supportFromEmail: doc.supportFromEmail,
      supportSmtpUser: doc.supportSmtpUser,
      supportReplyTo: doc.supportReplyTo,
      systemFromName: doc.systemFromName,
      systemFromEmail: doc.systemFromEmail,
      systemSmtpUser: doc.systemSmtpUser,
      systemReplyTo: doc.systemReplyTo,
      adminFromName: doc.adminFromName,
      adminFromEmail: doc.adminFromEmail,
      adminSmtpUser: doc.adminSmtpUser,
      adminReplyTo: doc.adminReplyTo,
      replyTo: doc.replyTo,
      smtpProvider: doc.smtpProvider ?? 'custom',
      smtpHost: doc.smtpHost,
      smtpPort: doc.smtpPort || 0,
      smtpSecure: doc.smtpSecure,
      smtpUser: doc.smtpUser,
      emailLogoSource: resolveStoredEmailLogoSource(doc),
      logoUrl: doc.logoUrl,
      footerText: doc.footerText,
      primaryColor: doc.primaryColor,
      updatedAt: doc.updatedAt,
    };
  }

  async getSmtpAdminStatus(): Promise<EmailSmtpAdminStatus> {
    const doc = await this.getOrCreateWithSecrets();
    const env = this.mailEnv();
    const effective = await this.getEffectiveSmtp();
    const effectiveSender = await this.getEffective();
    const user = effective.user ?? '';
    const useEnvFallback = shouldUseEnvEmailFallback(doc);
    return {
      configured: effective.configured,
      hasPassword: Boolean(
        doc.smtpPass?.trim() || (useEnvFallback && env.pass),
      ),
      host: effective.host ?? '',
      port: effective.port,
      secure: effective.secure,
      hasAuth: Boolean(user),
      usernameMasked: maskUsername(user),
      fromDisplay: formatFromAddress(
        effectiveSender.fromName,
        effectiveSender.fromEmail,
      ),
      envFromName: env.fromName,
      envFromEmail: env.fromEmail,
      adminEmail: env.adminEmail ?? env.fromEmail,
      orders: channelSmtpStatus(doc.ordersSmtpUser, doc.ordersSmtpPass),
      support: channelSmtpStatus(doc.supportSmtpUser, doc.supportSmtpPass),
      system: channelSmtpStatus(doc.systemSmtpUser, doc.systemSmtpPass),
      admin: channelSmtpStatus(doc.adminSmtpUser, doc.adminSmtpPass),
    };
  }

  /** Effective settings used at send time (env defaults + DB overrides). */
  async getEffective(): Promise<EffectiveEmailSettings> {
    if (this.cache && Date.now() < this.cache.expires) {
      return this.cache.value;
    }
    const doc = await this.getOrCreate();
    const env = this.mailEnv();
    const useEnvFallback = shouldUseEnvEmailFallback(doc);
    const appearance = (await this.panelSettings.getConfig()).appearance;
    const value: EffectiveEmailSettings = {
      enabled: doc.enabled,
      mockMode: doc.mockMode,
      orderCustomerEmailsEnabled: doc.orderCustomerEmailsEnabled !== false,
      adminOrderAlertEmailsEnabled: doc.adminOrderAlertEmailsEnabled !== false,
      fromName:
        doc.fromName?.trim() ||
        (useEnvFallback ? env.fromName : '') ||
        'UniQbd',
      fromEmail:
        doc.fromEmail?.trim() || (useEnvFallback ? env.fromEmail : ''),
      ordersFromName: doc.ordersFromName?.trim() || '',
      ordersFromEmail: doc.ordersFromEmail?.trim() || '',
      ordersReplyTo: doc.ordersReplyTo?.trim() || '',
      supportFromName: doc.supportFromName?.trim() || '',
      supportFromEmail: doc.supportFromEmail?.trim() || '',
      supportReplyTo: doc.supportReplyTo?.trim() || '',
      systemFromName: doc.systemFromName?.trim() || '',
      systemFromEmail: doc.systemFromEmail?.trim() || '',
      systemReplyTo: doc.systemReplyTo?.trim() || '',
      adminFromName: doc.adminFromName?.trim() || '',
      adminFromEmail: doc.adminFromEmail?.trim() || '',
      adminReplyTo: doc.adminReplyTo?.trim() || '',
      replyTo: doc.replyTo?.trim() || undefined,
      emailLogoSource: resolveStoredEmailLogoSource(doc),
      logoUrl: resolveEmailLogoUrl(doc, appearance),
      footerText:
        doc.footerText?.trim() || '© 2020 UniQbd. All Rights Reserved.',
      primaryColor: doc.primaryColor?.trim() || DEFAULT_PRIMARY_COLOR,
      webUrl: env.webUrl,
      assetBaseUrl:
        this.config.get<string>('app.publicUrl')?.trim() || env.webUrl,
      apiGlobalPrefix:
        this.config.get<string>('app.globalPrefix')?.trim() || 'api',
    };
    this.cache = { value, expires: Date.now() + CACHE_MS };
    return value;
  }

  async getEffectiveSmtp(): Promise<EffectiveSmtpConfig> {
    if (this.smtpCache && Date.now() < this.smtpCache.expires) {
      return this.smtpCache.value;
    }
    const doc = await this.getOrCreateWithSecrets();
    const env = this.mailEnv();
    const useEnvFallback = shouldUseEnvEmailFallback(doc);
    const host = doc.smtpHost?.trim() || (useEnvFallback ? env.host : undefined);
    const port =
      doc.smtpPort > 0 ? doc.smtpPort : useEnvFallback ? env.port : 587;
    const rawSecure = doc.smtpHost?.trim()
      ? doc.smtpSecure
      : useEnvFallback
        ? (env.secure ?? port === 465)
        : doc.smtpSecure;
    const secure = normalizeSmtpSecure(port, rawSecure);
    const user = doc.smtpUser?.trim() || (useEnvFallback ? env.user : undefined);
    const pass = doc.smtpPass?.trim() || (useEnvFallback ? env.pass : undefined);
    const value: EffectiveSmtpConfig = {
      host,
      port,
      secure,
      user,
      pass,
      configured: Boolean(host),
    };
    this.smtpCache = { value, expires: Date.now() + CACHE_MS };
    return value;
  }

  /** SMTP auth for a sender channel — uses channel mailbox when configured. */
  async getEffectiveSmtpForChannel(
    channel: EmailSenderChannel,
  ): Promise<EffectiveSmtpConfig> {
    const base = await this.getEffectiveSmtp();
    if (channel === 'default') return base;

    const doc = await this.getOrCreateWithSecrets();
    const channelUser = normalizeMailbox(readChannelSmtpUser(doc, channel));
    if (!channelUser) return base;

    const baseUser = base.user?.trim() ?? '';
    if (
      baseUser &&
      channelUser.toLowerCase() === baseUser.toLowerCase()
    ) {
      return base;
    }

    const channelPass = readChannelSmtpPass(doc, channel)?.trim();
    return {
      ...base,
      user: channelUser,
      pass: channelPass,
    };
  }

  /** Pre-flight check before SMTP verify/send for a sender channel. */
  async getChannelAuthIssue(
    channel: EmailSenderChannel,
  ): Promise<string | null> {
    if (channel === 'default') return null;

    const base = await this.getEffectiveSmtp();
    const doc = await this.getOrCreateWithSecrets();
    const channelUser = normalizeMailbox(readChannelSmtpUser(doc, channel));
    if (!channelUser) return null;

    const baseUser = base.user?.trim() ?? '';
    if (
      baseUser &&
      channelUser.toLowerCase() === baseUser.toLowerCase()
    ) {
      return null;
    }

    const channelPass = readChannelSmtpPass(doc, channel)?.trim();
    if (!channelPass) {
      const label = channelLabel(channel);
      return `${label} mailbox password is required for ${channelUser}. Enter the password on the ${label} tab, save settings, then test again.`;
    }

    return null;
  }

  async updateSettings(
    dto: UpdateEmailSettingsDto,
  ): Promise<EmailSettingsDocument> {
    const doc = await this.getOrCreateWithSecrets();
    if (dto.enabled !== undefined) doc.enabled = dto.enabled;
    if (dto.mockMode !== undefined) doc.mockMode = dto.mockMode;
    if (dto.orderCustomerEmailsEnabled !== undefined) {
      doc.orderCustomerEmailsEnabled = dto.orderCustomerEmailsEnabled;
    }
    if (dto.adminOrderAlertEmailsEnabled !== undefined) {
      doc.adminOrderAlertEmailsEnabled = dto.adminOrderAlertEmailsEnabled;
    }
    if (dto.fromName !== undefined) doc.fromName = dto.fromName;
    if (dto.fromEmail !== undefined) doc.fromEmail = normalizeMailbox(dto.fromEmail);
    if (dto.ordersFromName !== undefined) doc.ordersFromName = dto.ordersFromName.trim();
    if (dto.ordersFromEmail !== undefined) {
      doc.ordersFromEmail = normalizeMailbox(dto.ordersFromEmail);
    }
    if (dto.ordersSmtpUser !== undefined) {
      doc.ordersSmtpUser = normalizeMailbox(dto.ordersSmtpUser);
    }
    if (dto.ordersSmtpPass !== undefined && dto.ordersSmtpPass.trim()) {
      doc.ordersSmtpPass = dto.ordersSmtpPass.trim();
    }
    if (dto.ordersReplyTo !== undefined) {
      doc.ordersReplyTo = normalizeMailbox(dto.ordersReplyTo);
    }
    if (dto.supportFromName !== undefined) doc.supportFromName = dto.supportFromName.trim();
    if (dto.supportFromEmail !== undefined) {
      doc.supportFromEmail = normalizeMailbox(dto.supportFromEmail);
    }
    if (dto.supportSmtpUser !== undefined) {
      doc.supportSmtpUser = normalizeMailbox(dto.supportSmtpUser);
    }
    if (dto.supportSmtpPass !== undefined && dto.supportSmtpPass.trim()) {
      doc.supportSmtpPass = dto.supportSmtpPass.trim();
    }
    if (dto.supportReplyTo !== undefined) {
      doc.supportReplyTo = normalizeMailbox(dto.supportReplyTo);
    }
    if (dto.systemFromName !== undefined) doc.systemFromName = dto.systemFromName.trim();
    if (dto.systemFromEmail !== undefined) {
      doc.systemFromEmail = normalizeMailbox(dto.systemFromEmail);
    }
    if (dto.systemSmtpUser !== undefined) {
      doc.systemSmtpUser = normalizeMailbox(dto.systemSmtpUser);
    }
    if (dto.systemSmtpPass !== undefined && dto.systemSmtpPass.trim()) {
      doc.systemSmtpPass = dto.systemSmtpPass.trim();
    }
    if (dto.systemReplyTo !== undefined) {
      doc.systemReplyTo = normalizeMailbox(dto.systemReplyTo);
    }
    if (dto.adminFromName !== undefined) doc.adminFromName = dto.adminFromName.trim();
    if (dto.adminFromEmail !== undefined) {
      doc.adminFromEmail = normalizeMailbox(dto.adminFromEmail);
    }
    if (dto.adminSmtpUser !== undefined) {
      doc.adminSmtpUser = normalizeMailbox(dto.adminSmtpUser);
    }
    if (dto.adminSmtpPass !== undefined && dto.adminSmtpPass.trim()) {
      doc.adminSmtpPass = dto.adminSmtpPass.trim();
    }
    if (dto.adminReplyTo !== undefined) {
      doc.adminReplyTo = normalizeMailbox(dto.adminReplyTo);
    }
    if (dto.replyTo !== undefined) doc.replyTo = normalizeMailbox(dto.replyTo);
    if (dto.smtpProvider !== undefined) {
      doc.smtpProvider = dto.smtpProvider;
      if (dto.smtpProvider !== 'custom') {
        const preset = SMTP_PROVIDER_PRESETS[dto.smtpProvider];
        doc.smtpHost = preset.host;
        doc.smtpPort = preset.port;
        doc.smtpSecure = preset.secure;
      }
    }
    if (dto.smtpHost !== undefined) doc.smtpHost = dto.smtpHost;
    if (dto.smtpPort !== undefined) doc.smtpPort = dto.smtpPort;
    if (dto.smtpSecure !== undefined) doc.smtpSecure = dto.smtpSecure;
    if (dto.smtpPort !== undefined || dto.smtpSecure !== undefined) {
      const port = doc.smtpPort > 0 ? doc.smtpPort : 587;
      doc.smtpSecure = normalizeSmtpSecure(port, doc.smtpSecure);
    }
    if (dto.smtpUser !== undefined) doc.smtpUser = normalizeMailbox(dto.smtpUser);
    if (dto.smtpPass !== undefined && dto.smtpPass.trim()) {
      doc.smtpPass = dto.smtpPass.trim();
    }
    if (dto.logoUrl !== undefined) doc.logoUrl = dto.logoUrl;
    if (dto.emailLogoSource !== undefined) {
      doc.emailLogoSource = dto.emailLogoSource;
    }
    if (dto.footerText !== undefined) doc.footerText = dto.footerText;
    if (dto.primaryColor !== undefined) doc.primaryColor = dto.primaryColor;
    doc.useDatabaseOnly = true;
    await doc.save();
    this.invalidateCache();
    return doc;
  }

  private async getOrCreate(): Promise<EmailSettingsDocument> {
    let doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.settingsModel.create({ key: SETTINGS_KEY });
    }
    return doc;
  }

  private async getOrCreateWithSecrets(): Promise<EmailSettingsDocument> {
    let doc = await this.settingsModel
      .findOne({ key: SETTINGS_KEY })
      .select(
        '+smtpPass +ordersSmtpPass +supportSmtpPass +systemSmtpPass +adminSmtpPass',
      )
      .exec();
    if (!doc) {
      doc = await this.settingsModel.create({ key: SETTINGS_KEY });
      doc = await this.settingsModel
        .findById(doc._id)
        .select(
          '+smtpPass +ordersSmtpPass +supportSmtpPass +systemSmtpPass +adminSmtpPass',
        )
        .exec();
    }
    if (!doc) {
      throw new Error('Failed to load email settings');
    }
    return doc;
  }
}

function normalizeMailbox(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
}

function isEmailStoredInDatabase(
  doc: Pick<
    EmailSettingsDocument,
    | 'smtpHost'
    | 'smtpUser'
    | 'smtpPass'
    | 'fromEmail'
    | 'fromName'
    | 'smtpPort'
  >,
): boolean {
  return Boolean(
    doc.smtpHost?.trim() ||
      doc.smtpUser?.trim() ||
      doc.smtpPass?.trim() ||
      doc.fromEmail?.trim() ||
      doc.fromName?.trim() ||
      doc.smtpPort > 0,
  );
}

function shouldUseEnvEmailFallback(
  doc: Pick<EmailSettingsDocument, 'useDatabaseOnly'> &
    Parameters<typeof isEmailStoredInDatabase>[0],
): boolean {
  return !doc.useDatabaseOnly && !isEmailStoredInDatabase(doc);
}

function maskUsername(value: string): string {
  const v = value.trim();
  if (!v) return '—';
  if (v.length <= 3) return `${v[0]}***`;
  return `${v.slice(0, 3)}***`;
}

function formatFromAddress(name: string, email: string): string {
  if (name && email) return `${name} <${email}>`;
  return email || name || '—';
}

function channelSmtpStatus(
  user: string | undefined,
  pass: string | undefined,
): EmailChannelSmtpStatus {
  const trimmedUser = user?.trim() ?? '';
  return {
    hasPassword: Boolean(pass?.trim()),
    usernameMasked: trimmedUser ? maskUsername(trimmedUser) : '—',
  };
}

function readChannelSmtpUser(
  doc: EmailSettingsDocument,
  channel: EmailSenderChannel,
): string {
  switch (channel) {
    case 'orders':
      return doc.ordersSmtpUser ?? '';
    case 'support':
      return doc.supportSmtpUser ?? '';
    case 'system':
      return doc.systemSmtpUser ?? '';
    case 'admin':
      return doc.adminSmtpUser ?? '';
    default:
      return '';
  }
}

function readChannelSmtpPass(
  doc: EmailSettingsDocument,
  channel: EmailSenderChannel,
): string {
  switch (channel) {
    case 'orders':
      return doc.ordersSmtpPass ?? '';
    case 'support':
      return doc.supportSmtpPass ?? '';
    case 'system':
      return doc.systemSmtpPass ?? '';
    case 'admin':
      return doc.adminSmtpPass ?? '';
    default:
      return '';
  }
}

export function channelLabel(channel: EmailSenderChannel): string {
  switch (channel) {
    case 'orders':
      return 'Orders';
    case 'support':
      return 'Support';
    case 'system':
      return 'System';
    case 'admin':
      return 'Admin';
    default:
      return 'Default';
  }
}

export function resolveSenderIdentity(
  settings: EffectiveEmailSettings,
  channel: EmailSenderChannel,
): { name: string; email: string } {
  const fallbackName = settings.fromName?.trim() || 'Store';
  const fallbackEmail = settings.fromEmail?.trim() || '';

  switch (channel) {
    case 'orders':
      return {
        name: settings.ordersFromName?.trim() || fallbackName,
        email: settings.ordersFromEmail?.trim() || fallbackEmail,
      };
    case 'support':
      return {
        name: settings.supportFromName?.trim() || fallbackName,
        email: settings.supportFromEmail?.trim() || fallbackEmail,
      };
    case 'system':
      return {
        name: settings.systemFromName?.trim() || fallbackName,
        email: settings.systemFromEmail?.trim() || fallbackEmail,
      };
    case 'admin':
      return {
        name: settings.adminFromName?.trim() || fallbackName,
        email: settings.adminFromEmail?.trim() || fallbackEmail,
      };
    default:
      return { name: fallbackName, email: fallbackEmail };
  }
}

export function resolveReplyTo(
  settings: EffectiveEmailSettings,
  channel: EmailSenderChannel,
): string | undefined {
  const fallback = settings.replyTo?.trim() || undefined;

  switch (channel) {
    case 'orders':
      return settings.ordersReplyTo?.trim() || fallback;
    case 'support':
      return settings.supportReplyTo?.trim() || fallback;
    case 'system':
      return settings.systemReplyTo?.trim() || fallback;
    case 'admin':
      return settings.adminReplyTo?.trim() || fallback;
    default:
      return fallback;
  }
}

export function resolveStoredEmailLogoSource(
  doc: Pick<EmailSettingsDocument, 'emailLogoSource' | 'logoUrl'>,
): EmailLogoSource {
  const stored = doc.emailLogoSource?.trim().toLowerCase();
  if (
    stored === 'light' ||
    stored === 'dark' ||
    stored === 'system' ||
    stored === 'custom'
  ) {
    return stored;
  }
  if (doc.logoUrl?.trim()) return 'custom';
  return 'system';
}

export function resolveEmailLogoUrl(
  doc: Pick<EmailSettingsDocument, 'emailLogoSource' | 'logoUrl'>,
  appearance: SiteAppearanceConfig,
): string {
  const source = resolveStoredEmailLogoSource(doc);
  if (source === 'custom') return doc.logoUrl?.trim() || '';

  const light = appearance.logoUrlLight?.trim() || '';
  const dark = appearance.logoUrlDark?.trim() || '';

  switch (source) {
    case 'light':
      return light || dark;
    case 'dark':
      return dark || light;
    case 'system':
    default: {
      const theme = appearance.defaultTheme?.trim().toLowerCase();
      if (theme === 'light') return light || dark;
      if (theme === 'dark') return dark || light;
      // Email headers use a dark gradient — prefer the dark-theme logo.
      return dark || light;
    }
  }
}
