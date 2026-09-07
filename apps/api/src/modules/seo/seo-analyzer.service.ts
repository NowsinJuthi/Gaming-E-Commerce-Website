import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductStatus } from '../../common/enums';
import { Brand, BrandDocument } from '../../database/schemas/brand.schema';
import {
  Category,
  CategoryDocument,
} from '../../database/schemas/category.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';

const SCAN_LIMIT = 5000;
const SAMPLE_LIMIT = 10;

interface EntitySample {
  id: string;
  title: string;
  slug: string;
  type: 'product' | 'category' | 'brand';
}

interface IssueGroup {
  count: number;
  samples: EntitySample[];
}

interface DuplicateGroup {
  value: string;
  count: number;
  items: EntitySample[];
}

export interface SeoAnalyzerReport {
  score: number;
  totals: { products: number; categories: number; brands: number };
  issues: {
    missingMetaTitle: IssueGroup;
    missingMetaDescription: IssueGroup;
    missingCanonical: IssueGroup;
    missingAltTags: IssueGroup;
    duplicateTitles: { count: number; groups: DuplicateGroup[] };
    duplicateDescriptions: { count: number; groups: DuplicateGroup[] };
  };
  generatedAt: string;
}

interface ScanRow {
  _id: unknown;
  title?: string;
  slug?: string;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
  };
  media?: Array<{ url?: string; alt?: string }>;
}

@Injectable()
export class SeoAnalyzerService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Brand.name)
    private readonly brandModel: Model<BrandDocument>,
  ) {}

  async analyze(): Promise<SeoAnalyzerReport> {
    const [products, categories, brands] = await Promise.all([
      this.productModel
        .find({
          status: { $in: [ProductStatus.Active, ProductStatus.OutOfStock] },
        })
        .select('title slug seo media')
        .limit(SCAN_LIMIT)
        .lean()
        .exec() as Promise<ScanRow[]>,
      this.categoryModel
        .find({ isActive: { $ne: false } })
        .select('name slug seo')
        .limit(SCAN_LIMIT)
        .lean()
        .exec(),
      this.brandModel
        .find({})
        .select('name slug seo')
        .limit(SCAN_LIMIT)
        .lean()
        .exec(),
    ]);

    const missingMetaTitle: EntitySample[] = [];
    const missingMetaDescription: EntitySample[] = [];
    const missingCanonical: EntitySample[] = [];
    const missingAltTags: EntitySample[] = [];

    const titleMap = new Map<string, EntitySample[]>();
    const descMap = new Map<string, EntitySample[]>();

    const consider = (
      sample: EntitySample,
      seo: ScanRow['seo'],
      media?: ScanRow['media'],
    ) => {
      const metaTitle = seo?.metaTitle?.trim();
      const metaDesc = seo?.metaDescription?.trim();
      if (!metaTitle) missingMetaTitle.push(sample);
      if (!metaDesc) missingMetaDescription.push(sample);
      if (!seo?.canonicalUrl?.trim()) missingCanonical.push(sample);

      // Duplicate detection keys on the effective title/description.
      const effTitle = (metaTitle || sample.title).toLowerCase();
      if (effTitle) {
        const arr = titleMap.get(effTitle) ?? [];
        arr.push(sample);
        titleMap.set(effTitle, arr);
      }
      if (metaDesc) {
        const key = metaDesc.toLowerCase();
        const arr = descMap.get(key) ?? [];
        arr.push(sample);
        descMap.set(key, arr);
      }

      if (media && media.length > 0) {
        const anyMissingAlt = media.some((m) => !m.alt?.trim());
        if (anyMissingAlt) missingAltTags.push(sample);
      }
    };

    for (const p of products) {
      consider(
        {
          id: String(p._id),
          title: p.title ?? '',
          slug: p.slug ?? '',
          type: 'product',
        },
        p.seo,
        p.media,
      );
    }
    for (const c of categories as unknown as Array<
      ScanRow & { name?: string }
    >) {
      consider(
        {
          id: String(c._id),
          title: c.name ?? '',
          slug: c.slug ?? '',
          type: 'category',
        },
        c.seo,
      );
    }
    for (const b of brands as unknown as Array<ScanRow & { name?: string }>) {
      consider(
        {
          id: String(b._id),
          title: b.name ?? '',
          slug: b.slug ?? '',
          type: 'brand',
        },
        b.seo,
      );
    }

    const dupTitleGroups = this.duplicates(titleMap);
    const dupDescGroups = this.duplicates(descMap);

    const totalEntities = products.length + categories.length + brands.length;
    const score = this.healthScore({
      total: totalEntities,
      missingTitle: missingMetaTitle.length,
      missingDesc: missingMetaDescription.length,
      missingAlt: missingAltTags.length,
      duplicates: dupTitleGroups.length + dupDescGroups.length,
    });

    return {
      score,
      totals: {
        products: products.length,
        categories: categories.length,
        brands: brands.length,
      },
      issues: {
        missingMetaTitle: this.group(missingMetaTitle),
        missingMetaDescription: this.group(missingMetaDescription),
        missingCanonical: this.group(missingCanonical),
        missingAltTags: this.group(missingAltTags),
        duplicateTitles: {
          count: dupTitleGroups.length,
          groups: dupTitleGroups,
        },
        duplicateDescriptions: {
          count: dupDescGroups.length,
          groups: dupDescGroups,
        },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private group(samples: EntitySample[]): IssueGroup {
    return { count: samples.length, samples: samples.slice(0, SAMPLE_LIMIT) };
  }

  private duplicates(map: Map<string, EntitySample[]>): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    for (const [value, items] of map) {
      if (items.length > 1) {
        groups.push({
          value: items[0]?.title || value,
          count: items.length,
          items: items.slice(0, SAMPLE_LIMIT),
        });
      }
    }
    return groups.sort((a, b) => b.count - a.count).slice(0, SAMPLE_LIMIT);
  }

  private healthScore(input: {
    total: number;
    missingTitle: number;
    missingDesc: number;
    missingAlt: number;
    duplicates: number;
  }): number {
    if (input.total === 0) return 100;
    const titleCov = 1 - input.missingTitle / input.total;
    const descCov = 1 - input.missingDesc / input.total;
    const altCov = 1 - input.missingAlt / input.total;
    const dupPenalty = Math.min(input.duplicates / input.total, 1);
    const raw =
      0.3 * titleCov + 0.3 * descCov + 0.2 * altCov + 0.2 * (1 - dupPenalty);
    return Math.max(0, Math.min(100, Math.round(raw * 100)));
  }
}
