import {

  ForbiddenException,

  Injectable,

  Logger,

  OnModuleInit,

} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import * as fs from 'node:fs';

import * as os from 'node:os';

import * as path from 'node:path';

import {

  LicenseSettings,

  LicenseSettingsDocument,

} from '../../database/schemas/license-settings.schema';

import { CryptoService } from '../../shared/crypto/crypto.service';

import { UpdateLicenseSettingsDto } from './dto/update-license-settings.dto';

import {

  LICENSE_ADMIN_ROUTE_FEATURES,

  LICENSE_FEATURE_KEYS,

  LICENSE_FEATURE_LABELS,

  type LicenseFeatureKey,

} from './license.constants';

import { getLicenseVendorConfig } from './license.vendor-config';



// eslint-disable-next-line @typescript-eslint/no-require-imports

const { AmarpinLicense } = require('../../integrations/license/amarpin-license.js');



const SETTINGS_KEY = 'global';



type LicenseApiResult = {

  success?: boolean;

  valid?: boolean;

  status?: string;

  code?: string;

  message?: string;

  grace?: boolean;

  cached?: boolean;

  features?: Record<string, boolean>;

  enabled?: boolean;

};



export type LicenseAdminStatus = {

  configured: boolean;

  serverReady: boolean;

  valid: boolean;

  status: string;

  code: string;

  message: string;

  grace: boolean;

  cached: boolean;

  devBypass: boolean;

  missingLicenseKey: boolean;

  missingSiteSecret: boolean;

  licenseKeyMasked: string;

  productId: string;

  websiteId: string;

  installationId: string;

  apiUrl: string;

  hasSiteSecret: boolean;

  lastValidatedAt: string | null;

  lastValidAt: string | null;

  features: Record<LicenseFeatureKey, boolean>;

  routeFeatures: typeof LICENSE_ADMIN_ROUTE_FEATURES;

  featureCatalog: Array<{

    key: LicenseFeatureKey;

    label: string;

    enabled: boolean;

  }>;

};



@Injectable()

export class LicenseService implements OnModuleInit {

  private readonly logger = new Logger(LicenseService.name);



  constructor(

    @InjectModel(LicenseSettings.name)

    private readonly settingsModel: Model<LicenseSettingsDocument>,

    private readonly config: ConfigService,

    private readonly crypto: CryptoService,

  ) {}



  async onModuleInit(): Promise<void> {

    try {

      await this.bootstrapStoredLicense();

    } catch (err) {

      this.logger.warn(

        `License bootstrap skipped: ${

          err instanceof Error ? err.message : String(err)

        }`,

      );

    }

  }



  async getAdminStatus(): Promise<LicenseAdminStatus> {

    const doc = await this.getSettingsWithLegacySecret();

    const hasKey = Boolean(doc.licenseKey?.trim());

    const hasSecret = this.hasSiteSecret(doc);

    const serverReady = hasSecret;

    const configured = hasKey && serverReady;

    const devBypass = this.isDevBypassActive(configured);



    const productId = this.resolveProductId(doc);

    const websiteId = this.resolveWebsiteId(doc);

    const apiUrl = this.resolveApiUrl(doc);



    if (devBypass) {

      const features = this.allFeaturesEnabled();

      return {

        configured: false,

        serverReady,

        valid: false,

        status: 'DEV_BYPASS',

        code: 'DEV_BYPASS',

        message:

          'Development mode: license not set up yet — all features unlocked locally.',

        grace: false,

        cached: false,

        devBypass: true,

        missingLicenseKey: !hasKey,

        missingSiteSecret: !hasSecret,

        licenseKeyMasked: this.maskLicenseKey(doc.licenseKey),

        productId,

        websiteId,

        installationId: doc.installationId,

        apiUrl,

        hasSiteSecret: hasSecret,

        lastValidatedAt: doc.lastValidatedAt?.toISOString() ?? null,

        lastValidAt: doc.lastValidAt?.toISOString() ?? null,

        features,

        routeFeatures: LICENSE_ADMIN_ROUTE_FEATURES,

        featureCatalog: LICENSE_FEATURE_KEYS.map((key) => ({

          key,

          label: LICENSE_FEATURE_LABELS[key],

          enabled: true,

        })),

      };

    }



    const result = configured

      ? await this.validate(false)

      : {

          success: false,

          valid: false,

          code: 'NOT_CONFIGURED',

          message: this.setupMessage(hasKey, serverReady),

          features: {},

        };



    const features = this.normalizeFeatures(result.features ?? doc.lastFeatures);

    return {

      configured,

      serverReady,

      valid: result.valid === true,

      status: String(result.status ?? doc.lastStatus ?? ''),

      code: String(result.code ?? doc.lastCode ?? ''),

      message: String(result.message ?? this.setupMessage(hasKey, serverReady)),

      grace: result.grace === true,

      cached: result.cached === true,

      devBypass: false,

      missingLicenseKey: !hasKey,

      missingSiteSecret: !hasSecret,

      licenseKeyMasked: this.maskLicenseKey(doc.licenseKey),

      productId,

      websiteId,

      installationId: doc.installationId,

      apiUrl,

      hasSiteSecret: hasSecret,

      lastValidatedAt: doc.lastValidatedAt?.toISOString() ?? null,

      lastValidAt: doc.lastValidAt?.toISOString() ?? null,

      features,

      routeFeatures: LICENSE_ADMIN_ROUTE_FEATURES,

      featureCatalog: LICENSE_FEATURE_KEYS.map((key) => ({

        key,

        label: LICENSE_FEATURE_LABELS[key],

        enabled: features[key] === true,

      })),

    };

  }



  async updateSettings(

    dto: UpdateLicenseSettingsDto,

  ): Promise<LicenseAdminStatus> {

    await this.saveSettings(dto);

    return this.getAdminStatus();

  }



  async applyLicense(dto: UpdateLicenseSettingsDto): Promise<LicenseAdminStatus> {

    const key = dto.licenseKey?.trim();

    if (!key) {

      throw new ForbiddenException('Enter a license key.');

    }

    return this.activateWithKey(key);

  }



  async activateWithKey(licenseKey: string): Promise<LicenseAdminStatus> {

    const key = licenseKey.trim();

    if (!key) {

      throw new ForbiddenException('Enter a license key.');

    }

    await this.ensureServerReady();

    await this.saveSettings({ licenseKey: key });

    return this.activate();

  }



  async activate(): Promise<LicenseAdminStatus> {

    const doc = await this.getSettings();

    if (!doc.licenseKey?.trim()) {

      throw new ForbiddenException('Enter a license key.');

    }

    await this.ensureServerReady();

    const client = await this.createClient();

    if (!client) {

      throw new ForbiddenException(

        'License server is not configured. Set site secret in license.vendor-config.ts.',

      );

    }

    const result = (await client.activate()) as LicenseApiResult;

    await this.persistValidation(result);

    if (result.valid !== true) {

      throw new ForbiddenException(

        result.message || result.code || 'License activation failed',

      );

    }

    return this.getAdminStatus();

  }



  async deactivate(): Promise<LicenseAdminStatus> {

    const doc = await this.getSettings();

    if (!doc.licenseKey?.trim()) {

      return this.getAdminStatus();

    }



    const client = await this.createClient();

    if (client) {

      try {

        await client.deactivateInstallation();

      } catch (err) {

        this.logger.warn(

          `Amarpin deactivate: ${

            err instanceof Error ? err.message : String(err)

          }`,

        );

      }

    }



    doc.licenseKey = '';

    doc.lastFeatures = {};

    doc.lastStatus = '';

    doc.lastCode = '';

    doc.lastValidAt = null;

    doc.lastValidatedAt = new Date();

    await doc.save();

    this.clearLicenseCache();

    this.logger.log('License key removed. Licensed features are locked.');

    return this.getAdminStatus();

  }



  async validate(force = false): Promise<LicenseApiResult> {

    const client = await this.createClient();

    if (!client) {

      return {

        success: false,

        valid: false,

        code: 'NOT_CONFIGURED',

        message: 'License key and server vendor config are required',

        features: {},

      };

    }

    const result = (await client.validate({ force })) as LicenseApiResult;

    await this.persistValidation(result);

    return result;

  }



  async hasFeature(feature: LicenseFeatureKey): Promise<boolean> {

    const doc = await this.getSettings();

    const configured = this.isFullyConfigured(doc);

    if (this.isDevBypassActive(configured)) {

      return true;

    }

    const client = await this.createClient();

    if (!client) {

      return false;

    }

    try {

      if (feature === 'email') {

        if ((await client.hasFeature('email')) === true) {

          return true;

        }

        return (await client.hasFeature('api')) === true;

      }

      return (await client.hasFeature(feature)) === true;

    } catch {

      return false;

    }

  }



  routeAllowed(adminPath: string): Promise<boolean> {

    const feature = LICENSE_ADMIN_ROUTE_FEATURES[adminPath];

    if (!feature) {

      return Promise.resolve(true);

    }

    return this.hasFeature(feature);

  }



  private async saveSettings(dto: UpdateLicenseSettingsDto): Promise<void> {

    const doc = await this.getSettingsWithLegacySecret();

    if (dto.licenseKey !== undefined) {

      doc.licenseKey = dto.licenseKey.trim();

    }

    if (dto.productId !== undefined) {

      doc.productId = dto.productId.trim();

    }

    if (dto.websiteId !== undefined) {

      doc.websiteId = dto.websiteId.trim();

    }

    if (dto.apiUrl !== undefined) {

      doc.apiUrl = dto.apiUrl.trim();

    }

    if (dto.siteSecret !== undefined && dto.siteSecret.trim()) {

      doc.siteSecret = dto.siteSecret.trim();

    }

    if (dto.installationId !== undefined) {

      doc.installationId = dto.installationId.trim();

    }

    if (!doc.installationId) {

      doc.installationId = this.crypto.generateToken(16);

    }

    await doc.save();

  }



  private async persistValidation(result: LicenseApiResult): Promise<void> {

    const doc = await this.getSettings();

    doc.lastValidatedAt = new Date();

    doc.lastStatus = String(result.status ?? '');

    doc.lastCode = String(result.code ?? '');

    if (result.features && typeof result.features === 'object') {

      doc.lastFeatures = result.features;

    }

    if (result.valid === true) {

      doc.lastValidAt = new Date();

    }

    await doc.save();

  }



  private async createClient(): Promise<InstanceType<typeof AmarpinLicense> | null> {

    const doc = await this.getSettingsWithLegacySecret();

    const licenseKey = doc.licenseKey.trim();

    const siteSecret = this.resolveSiteSecret(doc);

    if (!licenseKey || !siteSecret) {

      return null;

    }

    if (!doc.installationId) {

      doc.installationId = this.crypto.generateToken(16);

      await doc.save();

    }

    return new AmarpinLicense({

      apiUrl: this.resolveApiUrl(doc),

      licenseKey,

      installationId: doc.installationId.trim(),

      websiteId: this.resolveWebsiteId(doc) || undefined,

      siteSecret,

      cachePath: this.cachePath(),

    });

  }



  private cachePath(): string {

    const uploads = this.config.get<string>('UPLOADS_DIR');

    const base =

      uploads && uploads.trim()

        ? uploads.trim()

        : path.join(os.tmpdir(), 'uniqbd');

    try {

      fs.mkdirSync(base, { recursive: true });

    } catch {

      /* ignore */

    }

    return path.join(base, '.amarpin-license-cache.json');

  }



  private clearLicenseCache(): void {

    try {

      const cacheFile = this.cachePath();

      if (fs.existsSync(cacheFile)) {

        fs.unlinkSync(cacheFile);

      }

    } catch {

      /* ignore */

    }

  }



  private async getSettings(): Promise<LicenseSettingsDocument> {

    return this.getOrCreate(false);

  }



  /** Loads MongoDB doc including legacy siteSecret for migration fallback. */

  private async getSettingsWithLegacySecret(): Promise<LicenseSettingsDocument> {

    return this.getOrCreate(true);

  }



  private async getOrCreate(

    withLegacySecret: boolean,

  ): Promise<LicenseSettingsDocument> {

    const baseQuery = this.settingsModel.findOne({ key: SETTINGS_KEY });

    let doc = withLegacySecret

      ? await baseQuery.select('+siteSecret').exec()

      : await baseQuery.exec();

    if (!doc) {

      doc = await this.settingsModel.create({

        key: SETTINGS_KEY,

        installationId: this.crypto.generateToken(16),

        licenseKey: '',

        apiUrl: 'https://license.amarpin.com/api',

        productId: 'amarpin-pro',

        websiteId: '',

      });

      if (withLegacySecret) {

        doc = await this.settingsModel

          .findOne({ key: SETTINGS_KEY })

          .select('+siteSecret')

          .exec();

      }

    }

    if (!doc) {

      throw new Error('Could not load license settings');

    }

    if (!doc.installationId) {

      doc.installationId = this.crypto.generateToken(16);

      await doc.save();

    }

    return doc;

  }



  private async ensureServerReady(): Promise<void> {

    const doc = await this.getSettingsWithLegacySecret();

    if (!this.hasSiteSecret(doc)) {

      throw new ForbiddenException(

        'Server vendor config is missing. Save the site secret under Admin → Settings → License (stored in MongoDB).',

      );

    }

  }



  /** Re-validate stored license on API boot when key + vendor config exist. */

  private async bootstrapStoredLicense(): Promise<void> {

    const doc = await this.getSettingsWithLegacySecret();

    if (!this.isFullyConfigured(doc)) {

      return;

    }

    const result = await this.validate(false);

    if (result.valid === true) {

      this.logger.log('License valid (cached or remote check).');

      return;

    }

    try {

      await this.activate();

      this.logger.log('License activated from stored configuration.');

    } catch (err) {

      this.logger.warn(

        `License auto-activate failed: ${

          err instanceof Error ? err.message : String(err)

        }`,

      );

    }

  }



  private normalizeApiUrl(raw?: string): string {

    const fallback = getLicenseVendorConfig().apiUrl.trim() || 'https://license.amarpin.com/api';

    let url = (raw ?? fallback).trim();

    if (!url) {

      return fallback;

    }

    if (!/^https?:\/\//i.test(url)) {

      url = `https://${url.replace(/^\/+/, '')}`;

    }

    url = url.replace(/\/$/, '');

    if (!url.endsWith('/api')) {

      url = `${url}/api`;

    }

    return url;

  }



  private resolveApiUrl(doc?: LicenseSettingsDocument): string {

    const fromDoc = doc?.apiUrl?.trim();

    if (fromDoc) {

      return this.normalizeApiUrl(fromDoc);

    }

    const vendor = getLicenseVendorConfig().apiUrl?.trim();

    if (vendor) {

      return this.normalizeApiUrl(vendor);

    }

    return this.normalizeApiUrl('https://license.amarpin.com/api');

  }



  private resolveProductId(doc?: LicenseSettingsDocument): string {

    return (

      doc?.productId?.trim() ||

      getLicenseVendorConfig().productId?.trim() ||

      'amarpin-pro'

    );

  }



  private resolveWebsiteId(doc?: LicenseSettingsDocument): string {

    return (

      doc?.websiteId?.trim() ||

      getLicenseVendorConfig().websiteId?.trim() ||

      ''

    );

  }



  private resolveSiteSecret(doc?: LicenseSettingsDocument): string {

    return (

      doc?.siteSecret?.trim() ||

      getLicenseVendorConfig().siteSecret?.trim() ||

      ''

    );

  }



  private hasSiteSecret(doc?: LicenseSettingsDocument): boolean {

    return Boolean(this.resolveSiteSecret(doc));

  }



  private isFullyConfigured(doc: LicenseSettingsDocument): boolean {

    return Boolean(doc.licenseKey?.trim() && this.hasSiteSecret(doc));

  }



  private isDevBypassActive(configured: boolean): boolean {

    if (configured) {

      return false;

    }

    return this.config.get<string>('NODE_ENV') === 'development';

  }



  private allFeaturesEnabled(): Record<LicenseFeatureKey, boolean> {

    const map = {} as Record<LicenseFeatureKey, boolean>;

    for (const key of LICENSE_FEATURE_KEYS) {

      map[key] = true;

    }

    return map;

  }



  private setupMessage(hasKey: boolean, serverReady: boolean): string {

    if (!serverReady) {

      return 'Server vendor config is missing. Save the site secret in Admin → License (MongoDB), not in api.env.';

    }

    if (!hasKey) {

      return 'Enter your license key and click Activate.';

    }

    return 'Click Activate or Validate now.';

  }



  private maskLicenseKey(key: string): string {

    const trimmed = key.trim();

    if (!trimmed) return '';

    if (trimmed.length <= 8) return '••••';

    return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;

  }



  private normalizeFeatures(

    raw: Record<string, boolean> | null | undefined,

  ): Record<LicenseFeatureKey, boolean> {

    const map = {} as Record<LicenseFeatureKey, boolean>;

    for (const key of LICENSE_FEATURE_KEYS) {

      map[key] = raw?.[key] === true;

    }

    if (!map.email && map.api) {

      map.email = true;

    }

    return map;

  }

}


