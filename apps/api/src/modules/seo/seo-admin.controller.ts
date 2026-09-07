import { Body, Controller, Get, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SaveRobotsDto, ValidateRobotsDto } from './dto/save-robots.dto';
import { UpdateSeoSettingsDto } from './dto/update-seo-settings.dto';
import { SeoAnalyzerService } from './seo-analyzer.service';
import { SeoSettingsService } from './seo-settings.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('seo/admin')
export class SeoAdminController {
  constructor(
    private readonly settings: SeoSettingsService,
    private readonly analyzer: SeoAnalyzerService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.settings.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSeoSettingsDto) {
    return this.settings.updateSettings(dto);
  }

  @Get('analyzer')
  analyze() {
    return this.analyzer.analyze();
  }

  @Get('sitemap')
  sitemapStatus() {
    return this.settings.getSitemapStatus();
  }

  @Post('sitemap/regenerate')
  regenerateSitemap() {
    return this.settings.regenerateSitemap();
  }

  @Get('robots')
  async getRobots() {
    const doc = await this.settings.getSettings();
    return {
      useCustom: doc.robots.useCustom,
      content: doc.robots.content,
      effective: await this.settings.getRobotsContent(),
      generated: this.settings.defaultRobots(doc.global.canonicalDomain),
    };
  }

  @Put('robots')
  async saveRobots(@Body() dto: SaveRobotsDto) {
    const doc = await this.settings.saveRobots(
      dto.content,
      dto.useCustom ?? true,
    );
    return {
      useCustom: doc.robots.useCustom,
      content: doc.robots.content,
      validation: this.settings.validateRobots(dto.content),
    };
  }

  @Post('robots/validate')
  validateRobots(@Body() dto: ValidateRobotsDto) {
    return this.settings.validateRobots(dto.content);
  }
}
