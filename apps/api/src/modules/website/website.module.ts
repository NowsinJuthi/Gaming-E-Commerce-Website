import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WebsiteSettings,
  WebsiteSettingsSchema,
} from '../../database/schemas/website-settings.schema';
import { WebsiteAdminController } from './website-admin.controller';
import { WebsitePublicController } from './website-public.controller';
import { WebsiteSettingsService } from './website-settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebsiteSettings.name, schema: WebsiteSettingsSchema },
    ]),
  ],
  controllers: [WebsiteAdminController, WebsitePublicController],
  providers: [WebsiteSettingsService],
  exports: [WebsiteSettingsService],
})
export class WebsiteModule {}
