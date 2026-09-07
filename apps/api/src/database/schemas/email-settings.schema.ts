import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmailSettingsDocument = HydratedDocument<EmailSettings>;

export type SmtpProviderPreset =
  | 'custom'
  | 'gmail'
  | 'sendgrid'
  | 'mailgun'
  | 'ses'
  | 'outlook';

/**
 * Admin-editable email settings: sender identity, SMTP transport, and branding.
 * Env vars (SMTP_*) remain as fallbacks when DB fields are empty.
 */
@Schema({ timestamps: true, collection: 'email_settings' })
export class EmailSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  /** Master switch — when false the mailer skips delivery. */
  @Prop({ default: true })
  enabled!: boolean;

  /** Log-only mode — messages are not sent even when SMTP is configured. */
  @Prop({ default: false })
  mockMode!: boolean;

  /**
   * Customer order emails (delivered, notes) via the Orders mailbox.
   * Independent of admin alerts and live chat — toggling this does not affect
   * other channels.
   */
  @Prop({ default: true })
  orderCustomerEmailsEnabled!: boolean;

  /**
   * Store admin new-order alert emails via the Admin mailbox.
   * Sent when a pending order is created — separate from customer emails.
   */
  @Prop({ default: true })
  adminOrderAlertEmailsEnabled!: boolean;

  /** Display name shown as the sender (falls back to SMTP_FROM_NAME). */
  @Prop({ trim: true, default: '' })
  fromName!: string;

  /** Sender address (falls back to SMTP_FROM_EMAIL). */
  @Prop({ trim: true, default: '' })
  fromEmail!: string;

  /** Orders lifecycle emails (falls back to fromName/fromEmail). */
  @Prop({ trim: true, default: '' })
  ordersFromName!: string;

  @Prop({ trim: true, default: '' })
  ordersFromEmail!: string;

  /** Optional separate mailbox login for orders (same SMTP host as global). */
  @Prop({ trim: true, default: '' })
  ordersSmtpUser!: string;

  @Prop({ select: false, default: '' })
  ordersSmtpPass!: string;

  @Prop({ trim: true, default: '' })
  ordersReplyTo!: string;

  /** Account / support emails (falls back to fromName/fromEmail). */
  @Prop({ trim: true, default: '' })
  supportFromName!: string;

  @Prop({ trim: true, default: '' })
  supportFromEmail!: string;

  @Prop({ trim: true, default: '' })
  supportSmtpUser!: string;

  @Prop({ select: false, default: '' })
  supportSmtpPass!: string;

  @Prop({ trim: true, default: '' })
  supportReplyTo!: string;

  /** System / diagnostic emails (falls back to fromName/fromEmail). */
  @Prop({ trim: true, default: '' })
  systemFromName!: string;

  @Prop({ trim: true, default: '' })
  systemFromEmail!: string;

  @Prop({ trim: true, default: '' })
  systemSmtpUser!: string;

  @Prop({ select: false, default: '' })
  systemSmtpPass!: string;

  @Prop({ trim: true, default: '' })
  systemReplyTo!: string;

  /** Store admin notifications (falls back to fromName/fromEmail). */
  @Prop({ trim: true, default: '' })
  adminFromName!: string;

  @Prop({ trim: true, default: '' })
  adminFromEmail!: string;

  @Prop({ trim: true, default: '' })
  adminSmtpUser!: string;

  @Prop({ select: false, default: '' })
  adminSmtpPass!: string;

  @Prop({ trim: true, default: '' })
  adminReplyTo!: string;

  /** Default Reply-To when a type-specific address is not set. */
  @Prop({ trim: true, default: '' })
  replyTo!: string;

  @Prop({
    trim: true,
    default: 'custom',
    enum: ['custom', 'gmail', 'sendgrid', 'mailgun', 'ses', 'outlook'],
  })
  smtpProvider!: SmtpProviderPreset;

  @Prop({ trim: true, default: '' })
  smtpHost!: string;

  @Prop({ default: 0 })
  smtpPort!: number;

  @Prop({ default: false })
  smtpSecure!: boolean;

  @Prop({ trim: true, default: '' })
  smtpUser!: string;

  /** SMTP password — never returned to clients. */
  @Prop({ select: false, default: '' })
  smtpPass!: string;

  /**
   * Which logo to render in the email header.
   * `custom` uses `logoUrl`; others pull from site appearance logos.
   */
  @Prop({ trim: true, default: 'system' })
  emailLogoSource!: string;

  /** Custom brand logo URL when `emailLogoSource` is `custom`. */
  @Prop({ trim: true, default: '' })
  logoUrl!: string;

  /** Footer body text (company line / address). Supports plain text. */
  @Prop({ trim: true, default: '' })
  footerText!: string;

  /** Accent / brand color used for buttons and headings. */
  @Prop({ trim: true, default: '' })
  primaryColor!: string;

  /**
   * When true, SMTP/sender settings come only from MongoDB — not .env fallbacks.
   * Set after the first admin save or one-time env seed on startup.
   */
  @Prop({ default: false })
  useDatabaseOnly!: boolean;

  updatedAt?: Date;
}

export const EmailSettingsSchema = SchemaFactory.createForClass(EmailSettings);
