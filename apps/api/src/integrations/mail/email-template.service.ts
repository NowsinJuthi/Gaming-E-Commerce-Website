import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { replaceLegacyBrandInText } from '../../common/utils/legacy-brand-migration';
import {
  EmailTemplate,
  EmailTemplateDocument,
} from '../../database/schemas/email-template.schema';
import { EmailContent, genericEmail } from './email-templates';
import {
  EMAIL_TEMPLATE_DEFAULTS,
  EMAIL_TEMPLATE_ID_SET,
} from './email-template.defaults';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import type { EffectiveEmailSettings } from './email-settings.service';

export type TemplateVars = Record<string, string | number | undefined | null>;

export interface EmailTemplateView {
  id: string;
  category: string;
  recipient: string;
  label: string;
  description: string;
  subject: string;
  heading: string;
  bodyText: string;
  buttonLabel: string;
  buttonUrl: string;
  enabled: boolean;
  updatedAt?: string;
}

export interface EmailTemplateStats {
  total: number;
  enabled: number;
  disabled: number;
  categories: number;
}

@Injectable()
export class EmailTemplateService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateService.name);
  private seeded = false;

  constructor(
    @InjectModel(EmailTemplate.name)
    private readonly model: Model<EmailTemplateDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const docs = await this.model.find().exec();
      const fields = [
        'label',
        'description',
        'subject',
        'heading',
        'bodyText',
        'buttonLabel',
        'buttonUrl',
      ] as const;

      let migrated = 0;
      for (const doc of docs) {
        let dirty = false;
        for (const field of fields) {
          const current = doc[field] ?? '';
          const next = replaceLegacyBrandInText(current);
          if (next !== current) {
            doc[field] = next;
            dirty = true;
          }
        }
        if (dirty) {
          await doc.save();
          migrated += 1;
        }
      }

      if (migrated > 0) {
        this.logger.log(
          `Migrated legacy brand text to UniQbd in ${migrated} email template(s)`,
        );
      }
    } catch (err) {
      this.logger.warn('Could not run legacy brand migration in email templates', err);
    }
  }

  buildVars(
    settings: EffectiveEmailSettings,
    extra: TemplateVars = {},
  ): TemplateVars {
    return {
      store_name: settings.fromName,
      store_url: settings.webUrl,
      ...extra,
    };
  }

  interpolate(
    template: string,
    vars: TemplateVars,
  ): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
      const value = vars[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    const count = await this.model.countDocuments().exec();
    if (count === 0) {
      await this.model.insertMany(EMAIL_TEMPLATE_DEFAULTS);
    } else {
      for (const def of EMAIL_TEMPLATE_DEFAULTS) {
        await this.model.updateOne(
          { id: def.id },
          { $setOnInsert: def },
          { upsert: true },
        );
      }
      for (const def of EMAIL_TEMPLATE_DEFAULTS) {
        await this.model.updateOne({ id: def.id }, { $set: { label: def.label } });
      }
      for (const def of EMAIL_TEMPLATE_DEFAULTS) {
        await this.model.updateOne(
          { id: def.id, enabled: { $exists: false } },
          { $set: { enabled: def.enabled } },
        );
      }
    }
    this.seeded = true;
  }

  private toView(doc: EmailTemplateDocument): EmailTemplateView {
    const def = EMAIL_TEMPLATE_DEFAULTS.find((d) => d.id === doc.id);
    const enabled =
      doc.enabled === true
        ? true
        : doc.enabled === false
          ? false
          : (def?.enabled ?? false);
    return {
      id: doc.id,
      category: doc.category,
      recipient: doc.recipient,
      label: doc.label,
      description: doc.description,
      subject: doc.subject,
      heading: doc.heading,
      bodyText: doc.bodyText,
      buttonLabel: doc.buttonLabel,
      buttonUrl: doc.buttonUrl,
      enabled,
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }

  async list(): Promise<{
    templates: EmailTemplateView[];
    stats: EmailTemplateStats;
  }> {
    await this.ensureSeeded();
    const docs = await this.model.find().sort({ category: 1, label: 1 }).exec();
    const templates = docs.map((d) => this.toView(d));
    const enabled = templates.filter((t) => t.enabled).length;
    const categories = new Set(templates.map((t) => t.category)).size;
    return {
      templates,
      stats: {
        total: templates.length,
        enabled,
        disabled: templates.length - enabled,
        categories,
      },
    };
  }

  async getById(id: string): Promise<EmailTemplateView> {
    await this.ensureSeeded();
    if (!EMAIL_TEMPLATE_ID_SET.has(id)) {
      throw new NotFoundException(`Email template "${id}" not found`);
    }
    const doc = await this.model.findOne({ id }).exec();
    if (!doc) {
      throw new NotFoundException(`Email template "${id}" not found`);
    }
    return this.toView(doc);
  }

  async update(
    id: string,
    dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplateView> {
    await this.ensureSeeded();
    if (!EMAIL_TEMPLATE_ID_SET.has(id)) {
      throw new NotFoundException(`Email template "${id}" not found`);
    }
    const doc = await this.model.findOne({ id }).exec();
    if (!doc) {
      throw new NotFoundException(`Email template "${id}" not found`);
    }
    if (dto.subject !== undefined) doc.subject = dto.subject;
    if (dto.heading !== undefined) doc.heading = dto.heading;
    if (dto.bodyText !== undefined) doc.bodyText = dto.bodyText;
    if (dto.buttonLabel !== undefined) doc.buttonLabel = dto.buttonLabel;
    if (dto.buttonUrl !== undefined) doc.buttonUrl = dto.buttonUrl;
    if (dto.enabled !== undefined) doc.enabled = dto.enabled;
    await doc.save();
    return this.toView(doc);
  }

  async reset(id: string): Promise<EmailTemplateView> {
    await this.ensureSeeded();
    const def = EMAIL_TEMPLATE_DEFAULTS.find((d) => d.id === id);
    if (!def) {
      throw new NotFoundException(`Email template "${id}" not found`);
    }
    const doc = await this.model.findOne({ id }).exec();
    if (!doc) {
      throw new NotFoundException(`Email template "${id}" not found`);
    }
    doc.subject = def.subject;
    doc.heading = def.heading;
    doc.bodyText = def.bodyText;
    doc.buttonLabel = def.buttonLabel;
    doc.buttonUrl = def.buttonUrl;
    doc.enabled = def.enabled;
    await doc.save();
    return this.toView(doc);
  }

  /** Whether the template library entry exists and is enabled (customer/admin sends skip when false). */
  async isTemplateEnabled(templateId: string): Promise<boolean> {
    await this.ensureSeeded();
    if (!EMAIL_TEMPLATE_ID_SET.has(templateId)) {
      return false;
    }
    const doc = await this.model
      .findOne({ id: templateId })
      .select('enabled')
      .lean()
      .exec();
    if (doc?.enabled === true) return true;
    if (doc?.enabled === false) return false;
    const def = EMAIL_TEMPLATE_DEFAULTS.find((d) => d.id === templateId);
    return def?.enabled ?? false;
  }

  /**
   * Merge admin overrides with a built-in template. Returns null when disabled.
   * When heading/body are empty, keeps built-in HTML and only overrides subject.
   */
  async mergeContentAsync(
    templateId: string,
    builtIn: EmailContent,
    vars: TemplateVars,
    settings: EffectiveEmailSettings,
  ): Promise<EmailContent | null> {
    await this.ensureSeeded();
    const doc = await this.model.findOne({ id: templateId }).exec();
    const def = EMAIL_TEMPLATE_DEFAULTS.find((d) => d.id === templateId);
    const enabled =
      doc?.enabled === true
        ? true
        : doc?.enabled === false
          ? false
          : (def?.enabled ?? false);
    if (!doc || !enabled) return null;
    const subjectTemplate =
      doc.subject?.trim() || def?.subject || builtIn.subject;
    const subject = this.interpolate(subjectTemplate, vars);

    const hasCustomBody = Boolean(
      doc.heading?.trim() || doc.bodyText?.trim(),
    );

    if (!hasCustomBody) {
      return { ...builtIn, subject };
    }

    const heading = this.interpolate(
      doc.heading?.trim() || def?.heading || builtIn.subject,
      vars,
    );
    const body = this.interpolate(doc.bodyText, vars);
    const buttonLabel = doc.buttonLabel?.trim()
      ? this.interpolate(doc.buttonLabel, vars)
      : undefined;
    const buttonUrl = doc.buttonUrl?.trim()
      ? this.interpolate(doc.buttonUrl, vars)
      : undefined;

    return {
      ...genericEmail(settings, {
        title: heading,
        body,
        ctaLabel: buttonLabel,
        ctaUrl: buttonUrl,
      }),
      subject,
    };
  }
}
