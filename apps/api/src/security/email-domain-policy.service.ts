import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../shared/audit/audit.service';
import { SecuritySettingsService } from './security-settings.service';

const REGISTRATION_DOMAIN_MESSAGE =
  'Registration is not allowed for this email domain.';

export function extractEmailDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    throw new BadRequestException('Invalid email address');
  }
  return trimmed.slice(at + 1);
}

@Injectable()
export class EmailDomainPolicyService {
  constructor(
    private readonly settings: SecuritySettingsService,
    private readonly audit: AuditService,
  ) {}

  async assertRegistrationAllowed(
    email: string,
    meta?: { ip?: string },
  ): Promise<void> {
    const { emailDomains } = await this.settings.getEffective();
    const domain = extractEmailDomain(email);
    const allowSet = new Set(emailDomains.allowlist);
    const blockSet = new Set(emailDomains.blocklist);

    const reject = (reason: 'blocklist' | 'allowlist') => {
      void this.audit.record({
        action: 'email_domain.blocked',
        metadata: { domain, reason, path: 'register' },
        ip: meta?.ip,
      });
      throw new BadRequestException(REGISTRATION_DOMAIN_MESSAGE);
    };

    if (blockSet.has(domain)) {
      reject('blocklist');
    }
    const allowlistActive = emailDomains.allowlist.length > 0;
    if (allowlistActive && !allowSet.has(domain)) {
      reject('allowlist');
    }
  }

  async getPublicRegistrationPolicy(): Promise<{
    allowlistEnabled: boolean;
    allowedDomains?: string[];
  }> {
    const { emailDomains } = await this.settings.getEffective();
    if (emailDomains.allowlist.length === 0) {
      return { allowlistEnabled: false };
    }
    return {
      allowlistEnabled: true,
      allowedDomains: [...emailDomains.allowlist],
    };
  }
}
