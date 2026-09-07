import { registerAs } from '@nestjs/config';

/**
 * SMTP transport + default sender configuration.
 * Production values are stored in MongoDB (`email_settings`) after the first
 * admin save. Env vars are used only for initial bootstrap / local dev.
 */
export interface MailConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromName: string;
  fromEmail: string;
  /** Inbox that receives operational alerts (e.g. new-order, contact form). */
  adminEmail?: string;
  /** Storefront base URL used to build links inside emails. */
  webUrl: string;
}

export const mailConfig = registerAs('mail', (): MailConfig => {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'no-reply@uniqbd.com';
  const webUrl = (
    process.env.WEB_APP_URL ??
    process.env.API_CORS_ORIGIN ??
    'http://localhost:3000'
  )
    .split(',')[0]
    ?.trim()
    .replace(/\/$/, '')
    ?? 'http://localhost:3000';

  return {
    host: process.env.SMTP_HOST || undefined,
    port: Number.isFinite(port) ? port : 587,
    // Implicit TLS on 465; STARTTLS (upgrade) on 587/25. Overridable via SMTP_SECURE.
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : port === 465,
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    fromName: process.env.SMTP_FROM_NAME || 'UniQbd',
    fromEmail,
    adminEmail: process.env.ADMIN_ALERT_EMAIL || fromEmail,
    webUrl,
  };
});
