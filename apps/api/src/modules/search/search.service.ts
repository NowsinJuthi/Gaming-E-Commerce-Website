import { DEFAULT_CURRENCY } from '@uniqbd/types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, HydratedDocument, Model, Types } from 'mongoose';
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
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';

const LIST_PROJECTION =
  'title slug pricing stock.available media availableRegions brandId categoryId type ratings createdAt';

interface FacetRow {
  _id: Types.ObjectId | string | null;
  count: number;
}

interface PriceRange {
  min: number;
  max: number;
}

interface FacetAggregate {
  brands: FacetRow[];
  categories: FacetRow[];
  regions: FacetRow[];
  price: PriceRange[];
  total: { count: number }[];
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Brand.name)
    private readonly brandModel: Model<BrandDocument>,
  ) {}

  async instantSearch(query: SearchQueryDto) {
    const filter = this.buildFilter(query);
    const useText = Boolean(query.q);
    if (useText && query.q) {
      filter.$text = { $search: query.q };
    }

    const skip = (query.page - 1) * query.limit;
    const cursor = this.productModel.find(filter);

    if (useText) {
      cursor
        .select({
          title: 1,
          slug: 1,
          pricing: 1,
          media: 1,
          brandId: 1,
          categoryId: 1,
          type: 1,
          ratings: 1,
          'stock.available': 1,
          score: { $meta: 'textScore' },
        })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      cursor.select(LIST_PROJECTION).sort({ createdAt: -1, _id: -1 });
    }

    const [items, total] = await Promise.all([
      cursor.skip(skip).limit(query.limit).lean().exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async autocomplete(query: AutocompleteQueryDto) {
    const prefix = query.q.toLowerCase().trim();
    const escaped = this.escapeRegex(prefix);
    const titleRegex = new RegExp(`^${escaped}`);
    const containsRegex = new RegExp(escaped, 'i');
    const nameRegex = new RegExp(`^${escaped}`, 'i');

    const productFilter = {
      status: ProductStatus.Active,
      titleNormalized: titleRegex,
    };

    let products = await this.productModel
      .find(productFilter)
      .select('title slug pricing.basePrice pricing.currency media')
      .sort({ titleNormalized: 1 })
      .limit(query.limit)
      .lean()
      .exec();

    if (products.length === 0 && prefix.length <= 3) {
      products = await this.productModel
        .find({
          status: ProductStatus.Active,
          titleNormalized: containsRegex,
        })
        .select('title slug pricing.basePrice pricing.currency media')
        .sort({ titleNormalized: 1 })
        .limit(query.limit)
        .lean()
        .exec();
    }

    const [categories, brands] = await Promise.all([
      this.categoryModel
        .find({ isActive: true, name: nameRegex })
        .select('name slug')
        .limit(5)
        .lean()
        .exec(),
      this.brandModel
        .find({ isActive: true, name: nameRegex })
        .select('name slug')
        .limit(5)
        .lean()
        .exec(),
    ]);

    return {
      products: products.map((p) => ({
        id: String(p._id),
        title: p.title,
        slug: p.slug,
        price: p.pricing?.basePrice ?? 0,
        currency: p.pricing?.currency ?? DEFAULT_CURRENCY,
        thumbnail: p.media?.[0]?.url,
      })),
      categories: categories.map((c) => ({
        id: String(c._id),
        name: c.name,
        slug: c.slug,
      })),
      brands: brands.map((b) => ({
        id: String(b._id),
        name: b.name,
        slug: b.slug,
      })),
    };
  }

  async facets(query: SearchQueryDto) {
    const filter = this.buildFilter(query);
    if (query.q) {
      filter.$text = { $search: query.q };
    }

    const aggregation = await this.productModel
      .aggregate<FacetAggregate>([
        { $match: filter },
        {
          $facet: {
            brands: [
              { $match: { brandId: { $ne: null } } },
              { $group: { _id: '$brandId', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 },
            ],
            categories: [
              { $group: { _id: '$categoryId', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 },
            ],
            regions: [
              { $unwind: '$availableRegions' },
              { $group: { _id: '$availableRegions', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            price: [
              {
                $group: {
                  _id: null,
                  min: { $min: '$pricing.basePrice' },
                  max: { $max: '$pricing.basePrice' },
                },
              },
            ],
            total: [{ $count: 'count' }],
          },
        },
      ])
      .exec();

    const result = aggregation[0];
    if (!result) {
      return {
        total: 0,
        brands: [],
        categories: [],
        regions: [],
        price: { min: 0, max: 0 },
      };
    }

    const [brands, categories] = await Promise.all([
      this.resolveNames(this.brandModel, result.brands),
      this.resolveNames(this.categoryModel, result.categories),
    ]);

    return {
      total: result.total[0]?.count ?? 0,
      brands,
      categories,
      regions: result.regions.map((r) => ({
        region: String(r._id),
        count: r.count,
      })),
      price: {
        min: result.price[0]?.min ?? 0,
        max: result.price[0]?.max ?? 0,
      },
    };
  }

  private buildFilter(query: SearchQueryDto): FilterQuery<ProductDocument> {
    const and: FilterQuery<ProductDocument>[] = [];
    const filter: FilterQuery<ProductDocument> = {
      status: ProductStatus.Active,
    };

    if (query.categoryId) {
      const categoryObjectId = new Types.ObjectId(query.categoryId);
      and.push({
        $or: [
          { categoryId: categoryObjectId },
          { categoryPath: categoryObjectId },
        ],
      });
    }
    if (query.brandId) {
      filter.brandId = new Types.ObjectId(query.brandId);
    }
    if (query.region) {
      filter.availableRegions = { $in: [query.region.toUpperCase(), 'GLOBAL'] };
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const price: Record<string, number> = {};
      if (query.minPrice !== undefined) price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) price.$lte = query.maxPrice;
      filter['pricing.basePrice'] = price;
    }
    if (and.length > 0) {
      filter.$and = and;
    }
    return filter;
  }

  private async resolveNames<T extends { name: string }>(
    model: Model<HydratedDocument<T>>,
    rows: FacetRow[],
  ): Promise<{ id: string; name: string; count: number }[]> {
    const ids = rows
      .map((row) => row._id)
      .filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);
    if (ids.length === 0) {
      return [];
    }
    const docs = await model
      .find({ _id: { $in: ids } })
      .select('name')
      .lean()
      .exec();
    const nameById = new Map(
      docs.map((doc) => [String(doc._id), doc.name]),
    );
    return rows
      .filter((row) => row._id instanceof Types.ObjectId)
      .map((row) => ({
        id: String(row._id),
        name: nameById.get(String(row._id)) ?? 'Unknown',
        count: row.count,
      }));
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
