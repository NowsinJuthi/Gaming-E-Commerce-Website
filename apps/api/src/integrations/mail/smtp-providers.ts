import { SmtpProviderPreset } from '../../database/schemas/email-settings.schema';

export interface SmtpProviderDefaults {
  label: string;
  host: string;
  port: number;
  secure: boolean;
}

export const SMTP_PROVIDER_PRESETS: Record<
  SmtpProviderPreset,
  SmtpProviderDefaults
> = {
  custom: { label: 'Custom SMTP', host: '', port: 587, secure: false },
  gmail: { label: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
  sendgrid: {
    label: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
  },
  mailgun: {
    label: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
  },
  ses: {
    label: 'Amazon SES',
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false,
  },
  outlook: {
    label: 'Outlook / Office 365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
  },
};
