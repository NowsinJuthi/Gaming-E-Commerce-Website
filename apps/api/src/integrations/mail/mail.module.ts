import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EmailSettings,
  EmailSettingsSchema,
} from '../../database/schemas/email-settings.schema';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '../../database/schemas/email-template.schema';
import { CustomerPanelModule } from '../../modules/customer-panel/customer-panel.module';
import { ContactInquiriesModule } from '../../modules/contact-inquiries/contact-inquiries.module';
import { LicenseModule } from '../../modules/license/license.module';
import { ContactController } from './contact.controller';
import { EmailAdminController } from './email-admin.controller';
import { EmailSettingsService } from './email-settings.service';
import { EmailTemplateService } from './email-template.service';
import { MailService } from './mail.service';
import { MailerService } from './mailer.service';

@Global()
@Module({
  imports: [
    CustomerPanelModule,
    ContactInquiriesModule,
    LicenseModule,
    MongooseModule.forFeature([
      { name: EmailSettings.name, schema: EmailSettingsSchema },
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  controllers: [EmailAdminController, ContactController],
  providers: [
    MailService,
    MailerService,
    EmailSettingsService,
    EmailTemplateService,
  ],
  exports: [
    MailService,
    MailerService,
    EmailSettingsService,
    EmailTemplateService,
  ],
})
export class MailModule {}
