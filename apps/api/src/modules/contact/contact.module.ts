import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ContactSettings,
  ContactSettingsSchema,
} from '../../database/schemas/contact-settings.schema';
import { ContactAdminController } from './contact-admin.controller';
import { ContactPublicController } from './contact-public.controller';
import { ContactSettingsService } from './contact-settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactSettings.name, schema: ContactSettingsSchema },
    ]),
  ],
  controllers: [ContactAdminController, ContactPublicController],
  providers: [ContactSettingsService],
  exports: [ContactSettingsService],
})
export class ContactModule {}
