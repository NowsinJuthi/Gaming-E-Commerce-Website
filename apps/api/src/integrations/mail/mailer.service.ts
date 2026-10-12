import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  EffectiveEmailSettings,
  EffectiveSmtpConfig,
  EmailSenderChannel,
  EmailSettingsService,
  channelLabel,
  resolveReplyTo,
  resolveSenderIdentity,
} from './email-settings.service';
import { EmailTemplateService, TemplateVars } from './email-template.service';
import {
  adminNewOrderEmail,
  chatReplyEmail,
  contactFormEmail,
  contactInquiryReplyEmail,
  emailVerificationEmail,
  EmailContent,
  EmailOrderItem,
  emailAssetUrl,
  genericEmail,
  orderConfirmationEmail,
  orderPendingEmail,
  orderCompletedEmail,
  orderCustomerNoteEmail,
  orderPaidConfirmationEmail,
  orderStatusUpdateEmail,
  otpLoginEmail,
  passwordResetEmail,
  paymentFailedEmail,
  productRequestReplyEmail,
  welcomeEmail,
} from './email-templates';
import { resolveOrderStatusTemplateId } from './order-email-template.ids';
import {
  isSmtpTlsVersionError,
  smtpTlsMismatchMessage,
} from './smtp-tls';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  senderChannel?: EmailSenderChannel;
}

export interface SendMailResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Reusable SMTP email service built on nodemailer.
 *
 * SMTP credentials and host can be configured in admin settings (DB) with env
 * fallbacks. When SMTP is not configured or email is disabled/mock, sends are
 * logged and skipped so the app keeps working without throwing.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;
  private verifiedKeys = new Set<string>();
  private transportKey = '';

  constructor(
    private readonly settings: EmailSettingsService,
    private readonly templates: EmailTemplateService,
  ) {}

  resetConnection(): void {
    this.transporter = null;
    this.verifiedKeys.clear();
    this.transportKey = '';
  }

  /** True when an SMTP host is configured (otherwise sandbox/log-only). */
  async isConfigured(): Promise<boolean> {
    const smtp = await this.settings.getEffectiveSmtp();
    return smtp.configured;
  }

  private transportSignature(smtp: EffectiveSmtpConfig): string {
    return [
      smtp.host ?? '',
      smtp.port,
      smtp.secure,
      smtp.user ?? '',
      smtp.pass ?? '',
    ].join('|');
  }

  private getTransporter(smtp: EffectiveSmtpConfig): Transporter {
    const key = this.transportSignature(smtp);
    if (this.transporter && this.transportKey === key) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: !smtp.secure && smtp.port === 587,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    this.transportKey = key;
    this.verifiedKeys.delete(key);
    return this.transporter;
  }

  /**
   * Verify the SMTP connection (and credentials). Used by the admin "Test
   * SMTP" button and before the first real send.
   */
  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    return this.verifyConnectionForChannel('default');
  }

  async verifyConnectionForChannel(
    channel: EmailSenderChannel = 'default',
  ): Promise<{ ok: boolean; error?: string }> {
    const authIssue = await this.settings.getChannelAuthIssue(channel);
    if (authIssue) {
      return { ok: false, error: authIssue };
    }

    const smtp = await this.settings.getEffectiveSmtpForChannel(channel);
    if (!smtp.configured) {
      return { ok: false, error: 'SMTP is not configured (missing SMTP host).' };
    }
    if (smtp.user && !smtp.pass) {
      return {
        ok: false,
        error: `SMTP password is missing for ${smtp.user}. Save the mailbox password, then test again.`,
      };
    }
    return this.verifySmtpConfig(smtp, channel);
  }

  private async verifySmtpConfig(
    smtp: EffectiveSmtpConfig,
    channel: EmailSenderChannel = 'default',
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.getTransporter(smtp).verify();
      this.verifiedKeys.add(this.transportSignature(smtp));
      this.logger.log(
        `SMTP connection verified successfully${smtp.user ? ` (${smtp.user})` : ''}.`,
      );
      return { ok: true };
    } catch (error) {
      this.verifiedKeys.delete(this.transportSignature(smtp));
      const message = (error as Error).message;
      this.logger.error(`SMTP verification failed: ${message}`);
      const tlsHint = smtpTlsMismatchMessage(smtp.port, smtp.secure);
      if (tlsHint) {
        return { ok: false, error: tlsHint };
      }
      if (isSmtpTlsVersionError(message)) {
        return {
          ok: false,
          error:
            'SMTP TLS mismatch: port 587 needs STARTTLS (SSL off); port 465 needs SSL on. Check host, port, and the SSL toggle in email settings.',
        };
      }
      if (
        /535|authentication credentials invalid|invalid login/i.test(message)
      ) {
        const label = channel === 'default' ? 'Default' : channelLabel(channel);
        const user = smtp.user?.trim();
        return {
          ok: false,
          error: user
            ? `${label} login failed for ${user}. Use a real mailbox from your hosting panel (lowercase, e.g. system@uniqbd.com), re-enter the password, save settings, then test again.`
            : `${label} login failed. Check SMTP username and password, save settings, then test again.`,
        };
      }
      return { ok: false, error: message };
    }
  }

  private async ensureVerified(smtp: EffectiveSmtpConfig): Promise<void> {
    const key = this.transportSignature(smtp);
    if (this.verifiedKeys.has(key)) return;
    const result = await this.verifySmtpConfig(smtp);
    if (!result.ok) {
      throw new Error(result.error ?? 'SMTP connection could not be verified');
    }
  }

  private resolveSendFrom(
    effective: EffectiveEmailSettings,
    smtp: EffectiveSmtpConfig,
    channel: EmailSenderChannel = 'default',
  ): { name: string; address: string; envelopeFrom: string } {
    const identity = resolveSenderIdentity(effective, channel);
    const name = identity.name?.trim() || 'Store';
    const authEmail = smtp.user?.includes('@') ? smtp.user.trim() : '';
    const address = identity.email?.trim() || authEmail || effective.fromEmail;
    const envelopeFrom = authEmail || address;
    return { name, address, envelopeFrom };
  }

  private templateSenderChannel(templateId: string): EmailSenderChannel {
    if (templateId === 'order.new_admin') return 'admin';
    if (templateId.startsWith('order.')) return 'orders';
    // Login, registration, and welcome codes use Default SMTP (admin test path).
    if (
      templateId === 'account.otp_login' ||
      templateId === 'account.verify_email' ||
      templateId === 'account.new_account'
    ) {
      return 'default';
    }
    if (templateId.startsWith('account.')) return 'support';
    if (templateId.startsWith('system.')) return 'system';
    return 'default';
  }

  /** Pre-flight for login OTP + email verification (same SMTP path as admin Default test). */
  async getAuthEmailReadiness(): Promise<{ ready: boolean; message?: string }> {
    const env = process.env.NODE_ENV;
    const effective = await this.settings.getEffective();
    if (!effective.enabled) {
      return {
        ready: false,
        message:
          'Outgoing email is disabled. Enable it in Admin → Settings → Email.',
      };
    }

    const smtp = await this.settings.getEffectiveSmtpForChannel('default');
    if (!smtp.configured) {
      if (env === 'development' && !effective.mockMode) {
        // Local dev: codes are printed in API logs when SMTP is not set up.
        return { ready: true };
      }
      return {
        ready: false,
        message:
          'SMTP is not configured. Set host and credentials under Admin → Settings → Email (Default).',
      };
    }
    if (smtp.user && !smtp.pass) {
      return {
        ready: false,
        message:
          'Default SMTP password is missing. Re-enter the mailbox password, save, then test again.',
      };
    }

    if (effective.mockMode) {
      if (env === 'development') {
        return { ready: true };
      }
      return {
        ready: false,
        message:
          'Email mock mode is on — login codes are logged only, not sent to inboxes.',
      };
    }

    const authIssue = await this.settings.getChannelAuthIssue('default');
    if (authIssue) {
      return { ready: false, message: authIssue };
    }

    const [otpEnabled, verifyEnabled] = await Promise.all([
      this.templates.isTemplateEnabled('account.otp_login'),
      this.templates.isTemplateEnabled('account.verify_email'),
    ]);
    if (!otpEnabled) {
      return {
        ready: false,
        message:
          'Template "OTP Login Code" is disabled. Enable it in Admin → Settings → Email → Templates.',
      };
    }

    if (!verifyEnabled) {
      return {
        ready: false,
        message:
          'Template "Email Verification" is disabled. Enable it in Admin → Settings → Email → Templates.',
      };
    }

    return { ready: true };
  }

  /** Pre-flight for customer password reset emails. */
  async getPasswordResetReadiness(): Promise<{ ready: boolean; message?: string }> {
    const base = await this.getAuthEmailReadiness();
    if (!base.ready) {
      return base;
    }
    const enabled = await this.templates.isTemplateEnabled(
      'account.reset_password',
    );
    if (!enabled) {
      return {
        ready: false,
        message:
          'Template "Password Reset" is disabled. Enable it in Admin → Settings → Email → Templates.',
      };
    }
    return { ready: true };
  }

  /** Low-level send. Never throws — returns a structured result. */
  async sendMail(input: SendMailInput): Promise<SendMailResult> {
    let effective: EffectiveEmailSettings;
    let smtp: EffectiveSmtpConfig;
    const channel = input.senderChannel ?? 'default';
    try {
      effective = await this.settings.getEffective();
      smtp = await this.settings.getEffectiveSmtpForChannel(channel);
    } catch (error) {
      this.logger.error(
        `Failed to load email settings: ${(error as Error).message}`,
      );
      return { success: false, error: (error as Error).message };
    }

    if (!effective.enabled) {
      this.logger.warn(
        `Email disabled — skipping "${input.subject}" to ${input.to}`,
      );
      return { success: true, skipped: true };
    }

    if (effective.mockMode) {
      this.logger.warn(
        `Mock mode — logging "${input.subject}" to ${input.to} (not sent)`,
      );
      return { success: true, skipped: true };
    }

    if (!smtp.configured) {
      this.logger.warn(
        `SMTP not configured — sandbox email "${input.subject}" to ${input.to}`,
      );
      return { success: true, skipped: true };
    }

    try {
      const from = this.resolveSendFrom(effective, smtp, channel);
      const info = await this.getTransporter(smtp).sendMail({
        from: { name: from.name, address: from.address },
        envelope: {
          from: from.envelopeFrom,
          to: input.to,
        },
        to: input.to,
        replyTo: input.replyTo ?? resolveReplyTo(effective, channel),
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      const messageId =
        typeof info?.messageId === 'string' ? info.messageId : undefined;
      this.logger.log(
        `Email sent to ${input.to} ("${input.subject}")${messageId ? ` id=${messageId}` : ''}`,
      );
      return { success: true, messageId };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(
        `Failed to send "${input.subject}" to ${input.to}: ${message}`,
      );
      return { success: false, error: message };
    }
  }

  /** Send a pre-rendered template to a recipient. */
  private send(
    to: string,
    content: EmailContent,
    senderChannel: EmailSenderChannel = 'default',
  ): Promise<SendMailResult> {
    return this.sendMail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      senderChannel,
    });
  }

  private async sendWithTemplate(
    templateId: string,
    to: string,
    content: EmailContent,
    vars: TemplateVars = {},
    senderChannelOverride?: EmailSenderChannel,
  ): Promise<SendMailResult> {
    const merged = await this.renderEmailContent(templateId, content, vars);
    if (!merged) {
      this.logger.warn(
        `Template "${templateId}" disabled — skipping email to ${to}`,
      );
      return { success: true, skipped: true };
    }
    return this.send(
      to,
      merged,
      senderChannelOverride ?? this.templateSenderChannel(templateId),
    );
  }

  /** Render merged template HTML without sending (admin delivery log preview). */
  async renderEmailContent(
    templateId: string,
    content: EmailContent,
    vars: TemplateVars = {},
  ): Promise<EmailContent | null> {
    await this.templates.ensureSeeded();
    const s = await this.settings.getEffective();
    return this.templates.mergeContentAsync(
      templateId,
      content,
      this.templates.buildVars(s, vars),
      s,
    );
  }

  // --- High-level, template-backed send methods --------------------------

  async sendWelcome(to: string, data: { name?: string }) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'account.new_account',
      to,
      welcomeEmail(s, data),
      { customer_name: data.name },
    );
  }

  async sendEmailVerification(
    to: string,
    data: { name?: string; code?: string; verifyUrl?: string },
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'account.verify_email',
      to,
      emailVerificationEmail(s, data),
      {
        customer_name: data.name,
        verification_code: data.code,
        verify_url: data.verifyUrl,
      },
    );
  }

  async sendLoginOtp(to: string, data: { name?: string; code: string }) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'account.otp_login',
      to,
      otpLoginEmail(s, data),
      {
        customer_name: data.name,
        verification_code: data.code,
      },
    );
  }

  async sendPasswordReset(
    to: string,
    data: { name?: string; resetUrl?: string; code?: string },
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'account.reset_password',
      to,
      passwordResetEmail(s, data),
      { customer_name: data.name, reset_url: data.resetUrl },
    );
  }

  /** Customer email when support replies in live chat (template-gated). */
  async sendChatReply(
    to: string,
    data: { name?: string; message: string; chatUrl?: string },
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate('account.chat_reply', to, chatReplyEmail(s, data), {
      customer_name: data.name,
      chat_message: data.message,
      chat_url: data.chatUrl ?? '/chat',
    });
  }

  /** Customer email when an admin replies to their product request. */
  async sendProductRequestReply(
    to: string,
    data: { name?: string; productName: string; message: string },
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'account.product_request_reply',
      to,
      productRequestReplyEmail(s, data),
      {
        customer_name: data.name,
        product_name: data.productName,
        reply_message: data.message,
      },
    );
  }

  /** Customer email when an admin replies to their contact message. */
  async sendContactInquiryReply(
    to: string,
    data: { name?: string; subject: string; message: string },
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'account.contact_inquiry_reply',
      to,
      contactInquiryReplyEmail(s, data),
      {
        customer_name: data.name,
        inquiry_subject: data.subject,
        reply_message: data.message,
      },
    );
  }

  async sendOrderPaid(
    to: string,
    data: {
      name?: string;
      orderNumber: string;
      items?: EmailOrderItem[];
      total: number;
      currency?: string;
      customerEmail?: string;
      customerMobile?: string;
      paymentMethod?: string;
      paymentTrxId?: string;
      orderUrl?: string;
    },
    senderChannel?: EmailSenderChannel,
    templateId: string = 'order.paid',
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      templateId,
      to,
      orderPaidConfirmationEmail(s, {
        name: data.name,
        orderNumber: data.orderNumber,
        items: data.items,
        total: data.total,
        currency: data.currency,
        customerEmail: data.customerEmail ?? to,
        customerMobile: data.customerMobile,
        paymentMethod: data.paymentMethod,
        paymentTrxId: data.paymentTrxId,
        orderUrl: data.orderUrl,
      }),
      {
        customer_name: data.name,
        order_number: data.orderNumber,
        order_total: `${data.currency ?? 'BDT'} ${data.total}`,
        order_id: data.orderUrl?.split('/').pop(),
      },
      senderChannel,
    );
  }

  async sendOrderConfirmation(
    to: string,
    data: {
      name?: string;
      orderNumber: string;
      items?: EmailOrderItem[];
      total: number;
      currency?: string;
      orderUrl?: string;
    },
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'order.processing',
      to,
      orderConfirmationEmail(s, data),
      {
        customer_name: data.name,
        order_number: data.orderNumber,
        order_total: `${data.currency ?? 'BDT'} ${data.total}`,
        order_id: data.orderUrl?.split('/').pop(),
      },
    );
  }

  async sendOrderPending(
    to: string,
    data: {
      name?: string;
      orderNumber: string;
      items?: EmailOrderItem[];
      total: number;
      currency?: string;
      orderUrl?: string;
    },
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'order.pending',
      to,
      orderPendingEmail(s, data),
      {
        customer_name: data.name,
        order_number: data.orderNumber,
        order_total: `${data.currency ?? 'BDT'} ${data.total}`,
        order_id: data.orderUrl?.split('/').pop(),
      },
    );
  }

  async sendOrderStatusUpdate(
    to: string,
    data: {
      name?: string;
      orderNumber: string;
      status: string;
      message?: string;
      orderUrl?: string;
      items?: EmailOrderItem[];
      total?: number;
      currency?: string;
      customerEmail?: string;
      customerMobile?: string;
      paymentMethod?: string;
      paymentTrxId?: string;
    },
    senderChannel?: EmailSenderChannel,
  ) {
    const s = await this.settings.getEffective();
    const statusKey = data.status.toLowerCase().replace(/\s+/g, '_');
    const templateId = resolveOrderStatusTemplateId(data.status);
    const paidContent =
      statusKey === 'paid'
        ? orderPaidConfirmationEmail(s, {
            name: data.name,
            orderNumber: data.orderNumber,
            items: data.items,
            total: data.total,
            currency: data.currency,
            customerEmail: data.customerEmail ?? to,
            customerMobile: data.customerMobile,
            paymentMethod: data.paymentMethod,
            paymentTrxId: data.paymentTrxId,
            orderUrl: data.orderUrl,
          })
        : null;
    const completedContent =
      statusKey === 'completed' || statusKey === 'delivered'
        ? orderCompletedEmail(s, {
            name: data.name,
            orderNumber: data.orderNumber,
            message: data.message,
            orderUrl: data.orderUrl,
          })
        : null;
    const content =
      paidContent ?? completedContent ?? orderStatusUpdateEmail(s, data);
    return this.sendWithTemplate(
      templateId,
      to,
      content,
      {
        customer_name: data.name,
        order_number: data.orderNumber,
        order_id: data.orderUrl?.split('/').pop(),
        order_total:
          data.total !== undefined
            ? `${data.currency ?? 'BDT'} ${data.total}`
            : undefined,
        note_message: data.message?.replace(/\n/g, '<br/>'),
      },
      senderChannel,
    );
  }

  async sendOrderCustomerNote(
    to: string,
    data: {
      name?: string;
      orderNumber: string;
      message: string;
      orderUrl?: string;
    },
    senderChannel?: EmailSenderChannel,
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'order.customer_note',
      to,
      orderCustomerNoteEmail(s, data),
      {
        customer_name: data.name,
        order_number: data.orderNumber,
        order_id: data.orderUrl?.split('/').pop(),
        note_message: data.message.replace(/\n/g, '<br/>'),
      },
      senderChannel,
    );
  }

  async sendPaymentSuccess(
    to: string,
    data: {
      name?: string;
      orderNumber?: string;
      amount: number;
      currency?: string;
      method?: string;
      orderUrl?: string;
      items?: EmailOrderItem[];
      customerEmail?: string;
      customerMobile?: string;
      paymentTrxId?: string;
    },
  ) {
    return this.sendOrderPaid(to, {
      name: data.name,
      orderNumber: data.orderNumber ?? '—',
      items: data.items,
      total: data.amount,
      currency: data.currency,
      customerEmail: data.customerEmail ?? to,
      customerMobile: data.customerMobile,
      paymentMethod: data.method,
      paymentTrxId: data.paymentTrxId,
      orderUrl: data.orderUrl,
    });
  }

  async sendPaymentFailed(
    to: string,
    data: {
      name?: string;
      orderNumber?: string;
      amount: number;
      currency?: string;
      reason?: string;
      retryUrl?: string;
    },
  ) {
    const s = await this.settings.getEffective();
    return this.sendWithTemplate(
      'order.failed',
      to,
      paymentFailedEmail(s, data),
      {
        customer_name: data.name,
        order_number: data.orderNumber,
        failure_reason: data.reason,
        order_id: data.orderNumber,
      },
    );
  }

  /** Contact-form submission → operational inbox (ADMIN_ALERT_EMAIL). */
  async sendContactMessage(data: {
    fromName: string;
    fromEmail: string;
    subject: string;
    message: string;
  }) {
    const s = await this.settings.getEffective();
    const to = (await this.settings.getSmtpAdminStatus()).adminEmail || s.fromEmail;
    return this.sendMail({
      to,
      replyTo: data.fromEmail,
      subject: contactFormEmail(s, data).subject,
      html: contactFormEmail(s, data).html,
      text: contactFormEmail(s, data).text,
      senderChannel: 'admin',
    });
  }

  /** New-order alert → operational inbox (ADMIN_ALERT_EMAIL). */
  async sendAdminNewOrder(data: {
    orderNumber: string;
    customerName?: string;
    customerEmail?: string;
    items?: EmailOrderItem[];
    total: number;
    currency?: string;
    orderUrl?: string;
  }) {
    const s = await this.settings.getEffective();
    if (!s.adminOrderAlertEmailsEnabled) {
      this.logger.warn(
        `Admin new-order alert skipped for ${data.orderNumber} — admin order alert emails are disabled in Email settings`,
      );
      return { success: true, skipped: true };
    }
    const to = (await this.settings.getSmtpAdminStatus()).adminEmail || s.fromEmail;
    return this.sendWithTemplate(
      'order.new_admin',
      to,
      adminNewOrderEmail(s, data),
      {
        order_number: data.orderNumber,
        customer_name: data.customerName,
        order_total: `${data.currency ?? 'BDT'} ${data.total}`,
        order_id: data.orderUrl?.split('/').pop(),
      },
    );
  }

  /** Sample order data for admin template library preview (order.invoice). */
  private static readonly ORDER_PAID_PREVIEW_SAMPLE = {
    name: 'Jane Customer',
    orderNumber: '1234',
    items: [
      {
        title: 'PUBG Mobile UC (PUBG Mobile 60 UC)',
        quantity: 1,
        unitPrice: 119,
        customerInputs: [
          {
            label:
              'নিচের বক্সে এ আপনার পাবজি মোবাইল গেম এর ইউ আইডি কোড দিন।',
            value: 'as',
          },
        ],
      },
      {
        title: 'PlayStation Network Card (৳2,500)',
        quantity: 1,
        unitPrice: 2500,
      },
    ],
    total: 2619,
    currency: 'BDT',
    customerEmail: 'jane.customer@example.com',
    paymentMethod: 'bKash',
    paymentTrxId: '8K7F2H9Q1L',
    orderUrl: '/orders/preview-sample',
  };

  /**
   * Full HTML preview for built-in transactional layouts (admin template library).
   * Returns available=false when the template uses custom heading/body or has no rich layout.
   */
  async previewTemplateHtml(templateId: string): Promise<{
    available: boolean;
    subject?: string;
    html?: string;
    usesBuiltInDesign?: boolean;
  }> {
    await this.templates.ensureSeeded();
    const view = await this.templates.getById(templateId);
    const hasCustom = Boolean(
      view.heading?.trim() || view.bodyText?.trim(),
    );

    if (
      (templateId !== 'order.paid' &&
        templateId !== 'order.invoice' &&
        templateId !== 'order.completed') ||
      hasCustom
    ) {
      return { available: false };
    }

    const s = await this.settings.getEffective();
    const sample = MailerService.ORDER_PAID_PREVIEW_SAMPLE;
    const sampleWithImages = {
      ...sample,
      items: sample.items.map((it, idx) => {
        if (idx !== 0) return it;
        const imageUrl = emailAssetUrl(s, s.logoUrl);
        return imageUrl ? { ...it, imageUrl } : it;
      }),
    };
    const builtIn =
      templateId === 'order.completed'
        ? orderCompletedEmail(s, {
            name: sample.name,
            orderNumber: sample.orderNumber,
            message:
              'Your order is complete. Your digital delivery is ready — open your order details for codes and instructions.',
            orderUrl: sample.orderUrl,
          })
        : orderPaidConfirmationEmail(s, sampleWithImages);
    const vars = this.templates.buildVars(s, {
      customer_name: sample.name,
      order_number: sample.orderNumber,
      order_id: 'preview-sample',
      order_total: `${sample.currency} ${sample.total}`,
    });
    const subject = this.templates.interpolate(
      view.subject?.trim() || builtIn.subject,
      vars,
    );

    return {
      available: true,
      subject,
      html: builtIn.html,
      usesBuiltInDesign: true,
    };
  }

  /** SMTP test for a specific sender channel (orders, support, system, or default). */
  async sendTestEmail(to: string, channel: EmailSenderChannel = 'system') {
    const s = await this.settings.getEffective();
    const identity = resolveSenderIdentity(s, channel);
    const channelLabel = testChannelLabel(channel);
    const fromDisplay =
      identity.email && identity.name
        ? `${identity.name} <${identity.email}>`
        : identity.email || identity.name || s.fromName;
    return this.send(
      to,
      genericEmail(s, {
        title: `${channelLabel} test email`,
        body: `This is a ${channelLabel.toLowerCase()} test email from ${fromDisplay}.\n\nIf you received this, the ${channelLabel.toLowerCase()} sender configuration is working correctly.`,
      }),
      channel,
    );
  }

  /** Generic event email used by the notification email channel. */
  async sendGeneric(
    to: string,
    data: { title: string; body: string; ctaLabel?: string; ctaUrl?: string },
  ) {
    const s = await this.settings.getEffective();
    return this.send(to, genericEmail(s, data), 'support');
  }
}

function testChannelLabel(channel: EmailSenderChannel): string {
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
