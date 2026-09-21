import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SecuritySettingsDocument = HydratedDocument<SecuritySettings>;

@Schema({ _id: false })
export class ThrottleSettingsDoc {
  @Prop({ default: true })
  enabled!: boolean;

  /** Global requests per IP per window (tuned for ~400K monthly visitors). */
  @Prop({ default: 500 })
  limit!: number;

  @Prop({ default: 60_000 })
  ttlMs!: number;

  @Prop({ default: 60_000 })
  blockMs!: number;

  @Prop({ default: 5 })
  registerLimit!: number;

  @Prop({ default: 10 })
  loginLimit!: number;

  @Prop({ default: 3 })
  otpLimit!: number;

  @Prop({ default: 60_000 })
  authTtlMs!: number;
}

@Schema({ _id: false })
export class RecaptchaSettingsDoc {
  @Prop({ default: false })
  enabled!: boolean;

  @Prop()
  siteKey?: string;

  /** Stored in DB when not set via RECAPTCHA_SECRET env. */
  @Prop({ select: false })
  secretKey?: string;

  @Prop({ default: 0.5 })
  minScore!: number;
}

@Schema({ _id: false })
export class CloudflareSettingsDoc {
  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 1 })
  trustProxyHops!: number;

  /** Reject requests missing Cloudflare headers (production hardening). */
  @Prop({ default: false })
  requireHeaders!: boolean;
}

@Schema({ _id: false })
export class ActivitySettingsDoc {
  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 60 })
  retentionDays!: number;

  /** 0–1 sample rate for mutating requests (lower = less DB load at scale). */
  @Prop({ default: 1 })
  sampleRate!: number;
}

@Schema({ _id: false })
export class HelmetSettingsDoc {
  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 15_552_000 })
  hstsMaxAgeSeconds!: number;
}

@Schema({ _id: false })
export class AuditSettingsDoc {
  @Prop({ default: true })
  enabled!: boolean;
}

@Schema({ _id: false })
export class EmailDomainPolicyDoc {
  @Prop({ default: false })
  allowlistEnabled!: boolean;

  /** Normalized hostnames, e.g. gmail.com */
  @Prop({ type: [String], default: [] })
  allowlist!: string[];

  @Prop({ type: [String], default: [] })
  blocklist!: string[];

  /** Admin saved email domain policy; skips auto default allowlist seed. */
  @Prop({ default: false })
  customized!: boolean;
}

/**
 * Singleton platform security configuration. Env vars seed defaults; admin
 * overrides persist here and apply at runtime (rate limits, captcha, activity).
 */
@Schema({
  timestamps: true,
  collection: 'security_settings',
})
export class SecuritySettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ type: ThrottleSettingsDoc, default: () => ({}) })
  throttle!: ThrottleSettingsDoc;

  @Prop({ type: RecaptchaSettingsDoc, default: () => ({}) })
  recaptcha!: RecaptchaSettingsDoc;

  @Prop({ type: CloudflareSettingsDoc, default: () => ({}) })
  cloudflare!: CloudflareSettingsDoc;

  @Prop({ type: ActivitySettingsDoc, default: () => ({}) })
  activity!: ActivitySettingsDoc;

  @Prop({ type: HelmetSettingsDoc, default: () => ({}) })
  helmet!: HelmetSettingsDoc;

  @Prop({ type: AuditSettingsDoc, default: () => ({}) })
  audit!: AuditSettingsDoc;

  @Prop({ type: EmailDomainPolicyDoc, default: () => ({}) })
  emailDomains!: EmailDomainPolicyDoc;

  updatedAt?: Date;
}

export const SecuritySettingsSchema =
  SchemaFactory.createForClass(SecuritySettings);
