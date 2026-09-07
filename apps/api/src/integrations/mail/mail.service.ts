import { Injectable, Logger } from '@nestjs/common';
import { MailerService, type SendMailResult } from './mailer.service';

export type AuthEmailDeliveryResult = {
  delivered: boolean;
  skipped: boolean;
  error?: string;
};

export type AuthEmailReadiness = {
  ready: boolean;
  message?: string;
};

/**
 * Backwards-compatible facade over {@link MailerService}. Auth verification
 * codes (OTP login + email verify) share one delivery pipeline via Default SMTP.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailer: MailerService) {}

  async getAuthEmailReadiness(): Promise<AuthEmailReadiness> {
    return this.mailer.getAuthEmailReadiness();
  }

  async getPasswordResetReadiness(): Promise<AuthEmailReadiness> {
    return this.mailer.getPasswordResetReadiness();
  }

  private toDeliveryResult(
    res: SendMailResult,
    label: string,
    email: string,
  ): AuthEmailDeliveryResult {
    if (!res.success) {
      this.logger.error(`${label} failed for ${email}: ${res.error ?? 'unknown error'}`);
      return { delivered: false, skipped: false, error: res.error };
    }
    if (res.skipped) {
      this.logger.warn(
        `${label} skipped for ${email} (SMTP disabled, mock mode, or template off)`,
      );
      return {
        delivered: false,
        skipped: true,
        error: 'Email delivery skipped',
      };
    }
    return { delivered: true, skipped: false };
  }

  async sendEmailVerification(
    email: string,
    code: string,
  ): Promise<AuthEmailDeliveryResult> {
    const verifyUrl = `/verify-email?email=${encodeURIComponent(email)}`;
    const res = await this.mailer.sendEmailVerification(email, {
      code,
      verifyUrl,
    });
    return this.toDeliveryResult(res, 'Email verification', email);
  }

  async sendOtp(
    email: string,
    code: string,
  ): Promise<AuthEmailDeliveryResult> {
    const res = await this.mailer.sendLoginOtp(email, { code });
    return this.toDeliveryResult(res, 'OTP login email', email);
  }

  async sendPasswordReset(
    email: string,
    code: string,
  ): Promise<AuthEmailDeliveryResult> {
    const resetUrl = `/reset-password?email=${encodeURIComponent(email)}`;
    const res = await this.mailer.sendPasswordReset(email, { code, resetUrl });
    return this.toDeliveryResult(res, 'Password reset email', email);
  }

  async sendWelcome(email: string, name?: string): Promise<void> {
    const res = await this.mailer.sendWelcome(email, { name });
    if (!res.success) {
      this.logger.warn(`Welcome email send failed for ${email}`);
    }
  }

  async sendSupportEmail(
    email: string,
    subject: string,
    message: string,
  ): Promise<void> {
    const res = await this.mailer.sendGeneric(email, {
      title: subject,
      body: message,
    });
    if (!res.success) {
      this.logger.warn(`Support email send failed for ${email}`);
    }
  }
}
