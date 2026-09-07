import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresLicenseFeature } from '../../modules/license/decorators/requires-license-feature.decorator';
import { LicenseFeatureGuard } from '../../modules/license/guards/license-feature.guard';
import {
  EmailSettingsService,
  resolveSenderIdentity,
} from './email-settings.service';
import { EmailTemplateService } from './email-template.service';
import { MailerService } from './mailer.service';
import { SMTP_PROVIDER_PRESETS } from './smtp-providers';
import { TestEmailDto } from './dto/test-email.dto';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('email/admin')
export class EmailAdminController {
  constructor(
    private readonly settings: EmailSettingsService,
    private readonly templates: EmailTemplateService,
    private readonly mailer: MailerService,
  ) {}

  @Get('settings')
  async getSettings() {
    const doc = await this.settings.getSettings();
    const smtp = await this.settings.getSmtpAdminStatus();
    const authEmail = await this.mailer.getAuthEmailReadiness();
    return {
      settings: this.settings.toSettingsView(doc),
      smtp,
      authEmail,
      providers: Object.entries(SMTP_PROVIDER_PRESETS).map(([id, preset]) => ({
        id,
        ...preset,
      })),
    };
  }

  @Patch('settings')
  @UseGuards(LicenseFeatureGuard)
  @RequiresLicenseFeature('email')
  async updateSettings(@Body() dto: UpdateEmailSettingsDto) {
    const doc = await this.settings.updateSettings(dto);
    this.mailer.resetConnection();
    return {
      settings: this.settings.toSettingsView(doc),
      smtp: await this.settings.getSmtpAdminStatus(),
    };
  }

  /** Verify SMTP connection only (no email sent). */
  @Post('verify')
  async verify() {
    const verify = await this.mailer.verifyConnection();
    return {
      ok: verify.ok,
      verified: verify.ok,
      error: verify.error,
    };
  }

  /** Verify the SMTP connection and (optionally) send a test email. */
  @Post('test')
  async test(@Body() dto: TestEmailDto) {
    const channel = dto.channel ?? 'system';
    const verify = await this.mailer.verifyConnectionForChannel(channel);
    if (!verify.ok) {
      return {
        ok: false,
        verified: false,
        sent: false,
        channel,
        error: verify.error,
      };
    }
    const effective = await this.settings.getEffective();
    const smtp = await this.settings.getEffectiveSmtpForChannel(channel);
    const identity = resolveSenderIdentity(effective, channel);
    const authEmail = smtp.user?.includes('@') ? smtp.user.trim() : '';
    const to =
      dto.to?.trim() ||
      identity.email?.trim() ||
      authEmail ||
      effective.fromEmail;
    const result = await this.mailer.sendTestEmail(to, channel);
    return {
      ok: result.success && !result.skipped,
      verified: true,
      sent: result.success && !result.skipped,
      skipped: result.skipped === true,
      failed: result.success !== true,
      channel,
      to,
      error: result.error,
    };
  }

  // --- Transactional templates ----------------------------------------------

  @Get('templates')
  listTemplates() {
    return this.templates.list();
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.templates.getById(id);
  }

  @Get('templates/:id/preview-html')
  previewTemplateHtml(@Param('id') id: string) {
    return this.mailer.previewTemplateHtml(id);
  }

  @Patch('templates/:id')
  @UseGuards(LicenseFeatureGuard)
  @RequiresLicenseFeature('email')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.templates.update(id, dto);
  }

  @Post('templates/:id/reset')
  @UseGuards(LicenseFeatureGuard)
  @RequiresLicenseFeature('email')
  resetTemplate(@Param('id') id: string) {
    return this.templates.reset(id);
  }
}
