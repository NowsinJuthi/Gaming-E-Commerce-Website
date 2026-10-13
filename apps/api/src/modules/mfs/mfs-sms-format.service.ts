import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MfsProvider } from '../../common/enums';
import {
  MfsSmsFormatSettings,
  MfsSmsFormatSettingsDocument,
  MfsSmsProviderFormatDoc,
} from '../../database/schemas/mfs-sms-format.schema';
import { DEFAULT_MFS_SMS_FORMATS } from './mfs-sms-format.defaults';
import {
  inferSmsSenderWithFormats,
  isAllowedSmsSenderWithFormats,
  parseSmsFieldsWithFormats,
} from './mfs-sms.parser';
import type {
  MfsSmsFormatsResponse,
  MfsSmsParseTestResult,
  MfsSmsProviderFormatConfig,
} from './mfs-sms-format.types';
import {
  TestMfsSmsFormatDto,
  UpdateMfsSmsFormatsDto,
} from './dto/mfs-sms-format.dto';

const SETTINGS_KEY = 'global';

@Injectable()
export class MfsSmsFormatService implements OnModuleInit {
  private cachedFormats: MfsSmsProviderFormatConfig[] | null = null;

  constructor(
    @InjectModel(MfsSmsFormatSettings.name)
    private readonly settingsModel: Model<MfsSmsFormatSettingsDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.getFormats();
  }

  async getFormats(): Promise<MfsSmsFormatsResponse> {
    const doc = await this.getOrCreate();
    const providers = this.mergeWithDefaults(doc.providers ?? []);
    this.cachedFormats = providers;
    return {
      providers,
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }

  /** Fast path for SMS sync — uses in-memory cache when available. */
  async getActiveFormats(): Promise<MfsSmsProviderFormatConfig[]> {
    if (this.cachedFormats) return this.cachedFormats;
    const { providers } = await this.getFormats();
    return providers;
  }

  async updateFormats(
    dto: UpdateMfsSmsFormatsDto,
  ): Promise<MfsSmsFormatsResponse> {
    const normalized = this.normalizeProviders(dto.providers);
    this.validateRegexPatterns(normalized);

    const doc = await this.settingsModel
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set: { providers: normalized } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!doc) {
      throw new BadRequestException('Could not save SMS formats');
    }

    const providers = this.mergeWithDefaults(doc.providers ?? []);
    this.cachedFormats = providers;
    return {
      providers,
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }

  async resetFormats(): Promise<MfsSmsFormatsResponse> {
    const doc = await this.settingsModel
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set: { providers: DEFAULT_MFS_SMS_FORMATS } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!doc) {
      throw new BadRequestException('Could not reset SMS formats');
    }

    this.cachedFormats = [...DEFAULT_MFS_SMS_FORMATS];
    return {
      providers: [...DEFAULT_MFS_SMS_FORMATS],
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }

  async testParse(dto: TestMfsSmsFormatDto): Promise<MfsSmsParseTestResult> {
    const formats = await this.getActiveFormats();
    const sender = dto.sender?.trim() ?? '';
    const body = dto.sms.trim();
    const provider = inferSmsSenderWithFormats(sender, body, formats);
    const parsed = parseSmsFieldsWithFormats(
      sender,
      body,
      undefined,
      undefined,
      formats,
    );

    return {
      provider,
      trxId: parsed.trxId,
      amount: parsed.amount,
      allowed: isAllowedSmsSenderWithFormats(sender, body, formats),
    };
  }

  private async getOrCreate(): Promise<MfsSmsFormatSettingsDocument> {
    let doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.settingsModel.create({
        key: SETTINGS_KEY,
        providers: DEFAULT_MFS_SMS_FORMATS,
      });
    }
    return doc;
  }

  private mergeWithDefaults(
    stored: MfsSmsProviderFormatDoc[],
  ): MfsSmsProviderFormatConfig[] {
    const byProvider = new Map(
      stored.map((row) => [row.provider, this.normalizeOne(row)]),
    );

    return DEFAULT_MFS_SMS_FORMATS.map((defaults) => {
      const saved = byProvider.get(defaults.provider);
      if (!saved) return defaults;
      const trxIdPatterns = this.upgradeStaleTrxPatterns(
        defaults.provider,
        saved.trxIdPatterns,
        defaults.trxIdPatterns,
      );
      return { ...defaults, ...saved, trxIdPatterns, provider: defaults.provider };
    });
  }

  /** Saved copies of the old bKash pattern ignore `TrxID:` from the phone app. */
  private upgradeStaleTrxPatterns(
    provider: MfsProvider,
    saved: string[],
    defaults: string[],
  ): string[] {
    if (
      provider === MfsProvider.Bkash &&
      saved.length === 1 &&
      saved[0] === 'TrxID\\s+([A-Za-z0-9]{6,})'
    ) {
      return defaults;
    }
    return saved.length > 0 ? saved : defaults;
  }

  private normalizeProviders(
    input: UpdateMfsSmsFormatsDto['providers'],
  ): MfsSmsProviderFormatDoc[] {
    const byProvider = new Map(
      input.map((row) => [row.provider, this.normalizeOne(row)]),
    );

    return DEFAULT_MFS_SMS_FORMATS.map((defaults) => {
      const patch = byProvider.get(defaults.provider);
      return patch ? { ...defaults, ...patch, provider: defaults.provider } : defaults;
    });
  }

  private normalizeOne(
    row: Partial<MfsSmsProviderFormatConfig> & { provider: MfsProvider },
  ): MfsSmsProviderFormatConfig {
    return {
      provider: row.provider,
      enabled: row.enabled ?? true,
      priority: Number.isFinite(row.priority) ? Number(row.priority) : 0,
      detectKeywords: this.cleanLines(row.detectKeywords),
      detectPatterns: this.cleanLines(row.detectPatterns),
      trxIdPatterns: this.cleanLines(row.trxIdPatterns),
      amountPatterns: this.cleanLines(row.amountPatterns),
      sampleSms: row.sampleSms?.trim() ?? '',
    };
  }

  private cleanLines(values?: string[]): string[] {
    if (!values?.length) return [];
    return values
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private validateRegexPatterns(formats: MfsSmsProviderFormatConfig[]): void {
    for (const fmt of formats) {
      for (const group of [
        fmt.detectPatterns,
        fmt.trxIdPatterns,
        fmt.amountPatterns,
      ]) {
        for (const pattern of group) {
          try {
            new RegExp(pattern, 'i');
          } catch {
            throw new BadRequestException(
              `Invalid regex for ${fmt.provider}: ${pattern}`,
            );
          }
        }
      }
    }
  }
}
