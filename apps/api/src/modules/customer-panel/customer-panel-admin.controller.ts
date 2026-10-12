import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LOGO_UPLOAD_MAX_BYTES } from '../../shared/uploads/logo-upload.constants';
import type { LogoUploadVariant } from '../../shared/uploads/logo-upload.constants';
import {
  logoUploadMulterOptions,
  validateLogoUploadFile,
} from '../../shared/uploads/logo-upload.multer';
import { processLogoImageUpload } from '../../shared/uploads/logo-image.processor';
import { BANNER_UPLOAD_MAX_BYTES } from '../../shared/uploads/banner-upload.constants';
import {
  bannerUploadMulterOptions,
  validateBannerUploadFile,
} from '../../shared/uploads/banner-upload.multer';
import { processBannerImageUpload } from '../../shared/uploads/banner-image.processor';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { CustomerPanelAdminService } from './customer-panel-admin.service';
import { CustomerPanelSettingsService } from './customer-panel-settings.service';
import { UpdateCustomerPanelSettingsDto } from './dto/update-customer-panel-settings.dto';
import { UploadLogoDto } from './dto/upload-logo.dto';
import { RequiresLicenseFeature } from '../license/decorators/requires-license-feature.decorator';
import { LicenseFeatureGuard } from '../license/guards/license-feature.guard';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('customer-panel/admin')
export class CustomerPanelAdminController {
  constructor(
    private readonly admin: CustomerPanelAdminService,
    private readonly settings: CustomerPanelSettingsService,
    private readonly uploads: UploadsService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('settings')
  async getSettings() {
    const doc = await this.settings.getSettings();
    const config = await this.settings.getConfig();
    return {
      storefront: doc.storefront,
      nav: doc.nav,
      rewards: doc.rewards,
      checkout: config.checkout,
      chat: config.chat,
      appearance: config.appearance,
      siteMenus: config.siteMenus,
      homepageSlides: config.homepageSlides,
      homepageFeaturedOnly: config.homepageFeaturedOnly,
      effective: config,
      updatedAt: doc.updatedAt,
    };
  }

  @Post('logo-upload')
  @UseInterceptors(FileInterceptor('file', logoUploadMulterOptions))
  async uploadLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: LOGO_UPLOAD_MAX_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadLogoDto,
    @Query('variant') queryVariant?: string,
  ) {
    const variant = String(dto.variant ?? queryVariant ?? '').toLowerCase();
    if (
      variant !== 'light' &&
      variant !== 'dark' &&
      variant !== 'admin' &&
      variant !== 'email' &&
      variant !== 'footer-light' &&
      variant !== 'footer-dark' &&
      variant !== 'admin-favicon'
    ) {
      throw new BadRequestException(
        'variant must be light, dark, admin, email, footer-light, footer-dark, or admin-favicon.',
      );
    }
    validateLogoUploadFile(file, variant as LogoUploadVariant);
    const filename = await processLogoImageUpload(
      file,
      variant as LogoUploadVariant,
    );
    const url = this.uploads.buildLogoPublicUrl(filename);
    return {
      url,
      variant: variant as LogoUploadVariant,
      filename,
    };
  }

  @Post('banner-upload')
  @UseInterceptors(FileInterceptor('file', bannerUploadMulterOptions))
  async uploadBanner(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: BANNER_UPLOAD_MAX_BYTES }),
        ],
        errorHttpStatusCode: 400,
      }),
    )
    file: Express.Multer.File,
  ) {
    validateBannerUploadFile(file);
    try {
      const filename = await processBannerImageUpload(file);
      const url = this.uploads.buildBannerPublicUrl(filename);
      return { url, filename };
    } catch (err) {
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  @Patch('settings')
  @UseGuards(LicenseFeatureGuard)
  @RequiresLicenseFeature('api')
  async updateSettings(@Body() dto: UpdateCustomerPanelSettingsDto) {
    const doc = await this.settings.updateSettings(dto);
    const config = await this.settings.getConfig();
    return {
      storefront: doc.storefront,
      nav: doc.nav,
      rewards: doc.rewards,
      checkout: config.checkout,
      chat: config.chat,
      appearance: config.appearance,
      siteMenus: config.siteMenus,
      homepageSlides: config.homepageSlides,
      homepageFeaturedOnly: config.homepageFeaturedOnly,
      effective: config,
      updatedAt: doc.updatedAt,
    };
  }
}
