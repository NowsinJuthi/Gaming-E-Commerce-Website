import { DEFAULT_CURRENCY } from '@uniqbd/types';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, SortOrder, Types } from 'mongoose';
import {
  InventoryStatus,
  ProductStatus,
} from '../../common/enums';
import { decodeCursor, encodeCursor } from '../../common/utils/cursor';
import {
  inventoryPackageValueIds,
  productHasPurchasableStock,
  productUsesInventoryItems,
  resolveProductAvailableStock,
} from '../../common/utils/product-variation-stock';
import { slugify } from '../../common/utils/slugify';
import { escapeRegex } from '../../common/utils/escape-regex';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../database/schemas/inventory-item.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import { EventsService } from '../../shared/events/events.service';
import { AppEvent } from '../../shared/events/events.types';
import { BrandService } from '../brands/brand.service';
import { CategoryService } from '../categories/category.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductSort, QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_LIST_TTL = CacheKeys.ttl.productList;
const PRODUCT_DETAIL_TTL = CacheKeys.ttl.productDetail;

const LIST_PROJECTION =
  'title slug pricing stock.available media availableRegions brandId categoryId type ratings status createdAt updatedAt deliveryType attributes featured';

const LIST_PROJECT_FIELDS: Record<string, 1> = {
  title: 1,
  slug: 1,
  pricing: 1,
  'stock.available': 1,
  media: 1,
  availableRegions: 1,
  brandId: 1,
  categoryId: 1,
  type: 1,
  ratings: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
  deliveryType: 1,
  attributes: 1,
  featured: 1,
};

/** Fields that must never be exposed in public product API responses. */
const INTERNAL_PRODUCT_FIELDS = ['supplierId', 'titleNormalized'] as const;
const INTERNAL_PRICING_FIELDS = ['cost'] as const;

function stripInternalProductFields(obj: Record<string, unknown>): void {
  for (const field of INTERNAL_PRODUCT_FIELDS) {
    delete obj[field];
  }
  if (obj.pricing && typeof obj.pricing === 'object') {
    const pricing = obj.pricing as Record<string, unknown>;
    for (const field of INTERNAL_PRICING_FIELDS) {
      delete pricing[field];
    }
  }
}

interface SortPlan {
  field: 'createdAt' | 'pricing.basePrice';
  ascending: boolean;
}

export interface ProductListResult {
  items: unknown[];
  nextCursor: string | null;
  limit: number;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItemDocument>,
    private readonly categories: CategoryService,
    private readonly brands: BrandService,
    private readonly cache: CacheService,
    private readonly events: EventsService,
  ) {}

  /** Invalidate all product list and detail caches (call after any product write). */
  async invalidateProductCache(slug?: string): Promise<void> {
    if (slug) await this.cache.del(CacheKeys.product.detail(slug));
    await Promise.all([
      this.cache.delByPrefix(CacheKeys.product.listPrefix),
      this.cache.delByPrefix(CacheKeys.product.homepageSectionsPrefix),
    ]);
  }

  private normalizeCategoryIds(dto: {
    categoryId?: string;
    categoryIds?: string[];
  }): string[] {
    if (dto.categoryIds?.length) {
      return [...new Set(dto.categoryIds)];
    }
    if (dto.categoryId) {
      return [dto.categoryId];
    }
    throw new BadRequestException('At least one category is required');
  }

  async create(dto: CreateProductDto): Promise<ProductDocument> {
    if (dto.brandId) {
      await this.brands.assertExists(dto.brandId);
    }
    const categories = await this.categories.resolveProductCategories(
      this.normalizeCategoryIds(dto),
    );
    const slug = await this.uniqueSlug(slugify(dto.slug ?? dto.title));

    const created = await this.productModel.create({
      title: dto.title,
      titleNormalized: dto.title.toLowerCase(),
      slug,
      description: dto.description,
      sku: dto.sku,
      categoryId: categories.categoryId,
      categoryIds: categories.categoryIds,
      categoryPath: categories.categoryPath,
      brandId: dto.brandId ? new Types.ObjectId(dto.brandId) : undefined,
      type: dto.type,
      deliveryType: dto.deliveryType,
      pricing: {
        ...dto.pricing,
        currency: dto.pricing.currency ?? DEFAULT_CURRENCY,
      },
      attributes: dto.attributes,
      media: dto.media,
      availableRegions: dto.availableRegions?.map((r) => r.toUpperCase()) ?? [
        'GLOBAL',
      ],
      seo: dto.seo,
      status: dto.status ?? ProductStatus.Draft,
      featured: dto.featured ?? false,
      ...(dto.stock?.available !== undefined
        ? { stock: { available: dto.stock.available, reserved: 0, sold: 0 } }
        : {}),
    });
    await this.invalidateProductCache(created.slug);
    this.events.emit(AppEvent.ProductCreated, {
      id: String(created._id),
      slug: created.slug,
      name: created.title,
    });
    return created;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    const update: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      update.title = dto.title;
      update.titleNormalized = dto.title.toLowerCase();
    }
    if (dto.description !== undefined) update.description = dto.description;
    if (dto.sku !== undefined) update.sku = dto.sku;
    if (dto.type !== undefined) update.type = dto.type;
    if (dto.deliveryType !== undefined) update.deliveryType = dto.deliveryType;
    if (dto.pricing !== undefined) {
      update.pricing = {
        ...dto.pricing,
        currency: dto.pricing.currency ?? DEFAULT_CURRENCY,
      };
    }
    if (dto.attributes !== undefined) update.attributes = dto.attributes;
    if (dto.media !== undefined) update.media = dto.media;
    if (dto.seo !== undefined) update.seo = dto.seo;
    if (dto.status !== undefined) update.status = dto.status;
    if (dto.availableRegions !== undefined) {
      update.availableRegions = dto.availableRegions.map((r) =>
        r.toUpperCase(),
      );
    }
    if (dto.slug !== undefined) {
      update.slug = await this.uniqueSlug(slugify(dto.slug), id);
    }
    if (dto.brandId !== undefined) {
      await this.brands.assertExists(dto.brandId);
      update.brandId = new Types.ObjectId(dto.brandId);
    }
    if (dto.categoryId !== undefined || dto.categoryIds !== undefined) {
      const categories = await this.categories.resolveProductCategories(
        this.normalizeCategoryIds(dto),
      );
      update.categoryId = categories.categoryId;
      update.categoryIds = categories.categoryIds;
      update.categoryPath = categories.categoryPath;
    }
    if (dto.featured !== undefined) update.featured = dto.featured;
    if (dto.stock?.available !== undefined) {
      update['stock.available'] = dto.stock.available;
      if (dto.stock.available > 0) {
        const existing = await this.productModel.findById(id).exec();
        if (existing?.status === ProductStatus.OutOfStock) {
          update.status = ProductStatus.Active;
        }
      }
    }

    const product = await this.productModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.invalidateProductCache(product.slug);
    this.events.emit(AppEvent.ProductUpdated, {
      id: String(product._id),
      slug: product.slug,
      name: product.title,
    });
    return product;
  }

  /**
   * Deletes products with no order history; otherwise archives to keep orders intact.
   */
  async remove(
    id: string,
  ): Promise<{ success: boolean; mode: 'deleted' | 'archived' }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Product not found');
    }
    const productId = new Types.ObjectId(id);
    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const linkedToOrders = await this.orderModel.exists({
      'items.productId': productId,
    });

    if (linkedToOrders) {
      await this.productModel
        .findByIdAndUpdate(productId, {
          $set: { status: ProductStatus.Archived },
        })
        .exec();
      await this.invalidateProductCache(product.slug);
      this.events.emit(AppEvent.ProductUpdated, {
        id,
        slug: product.slug,
        name: product.title,
      });
      return { success: true, mode: 'archived' };
    }

    await this.inventoryModel.deleteMany({ productId }).exec();
    await this.productModel.findByIdAndDelete(productId).exec();
    await this.invalidateProductCache(product.slug);
    this.events.emit(AppEvent.ProductDeleted, { id });
    return { success: true, mode: 'deleted' };
  }

  async findBySlug(slug: string): Promise<Record<string, unknown>> {
    const cacheKey = CacheKeys.product.detail(slug);
    const cached = await this.cache.getJson<Record<string, unknown>>(cacheKey);

    const product = await this.productModel
      .findOne({ slug: slug.toLowerCase(), status: ProductStatus.Active })
      .exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const raw = product.toObject() as unknown as Record<string, unknown>;
    // Strip internal-only fields before caching or returning to public clients.
    stripInternalProductFields(raw);

    const result = cached ?? raw;

    await this.attachDetailInventory(product, result);

    if (!cached) {
      await this.cache.setJson(cacheKey, result, PRODUCT_DETAIL_TTL);
    }

    return result;
  }

  private async attachDetailInventory(
    product: ProductDocument,
    result: Record<string, unknown>,
  ): Promise<void> {
    if (!productUsesInventoryItems(product)) return;

    const packageIds = inventoryPackageValueIds(product);
    if (packageIds.length === 0) {
      result.inventoryAvailable = await this.inventoryModel.countDocuments({
        productId: product._id,
        status: InventoryStatus.Available,
      });
      return;
    }

    const packageIdQuery = packageIds.flatMap((id) => {
      const values: Array<string | number> = [id];
      const numeric = Number(id);
      if (Number.isFinite(numeric)) values.push(numeric);
      return values;
    });

    const rows = await this.inventoryModel
      .aggregate<{ _id: string | number; count: number }>([
        {
          $match: {
            productId: product._id,
            status: InventoryStatus.Available,
            variationValueId: { $in: packageIdQuery },
          },
        },
        { $group: { _id: '$variationValueId', count: { $sum: 1 } } },
      ])
      .exec();

    const countsByValueId = new Map<string, number>();
    for (const row of rows) {
      countsByValueId.set(String(row._id), row.count);
    }
    const packageInventory = packageIds.map((valueId) => ({
      valueId,
      available: countsByValueId.get(valueId) ?? 0,
    }));

    result.packageInventory = packageInventory;
    result.inventoryAvailable = packageInventory.reduce(
      (sum, pkg) => sum + pkg.available,
      0,
    );
    result.inStock = productHasPurchasableStock(
      product,
      result.inventoryAvailable as number,
    );
  }

  /** Admin/supplier listing across all statuses (drafts, archived, etc.). */
  async adminList(query: {
    search?: string;
    status?: string;
    categoryId?: string;
    brandId?: string;
    limit?: number;
  }): Promise<{ items: unknown[] }> {
    const filter: FilterQuery<ProductDocument> = {};
    if (query.status === 'all') {
      /* include every status */
    } else if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = { $ne: ProductStatus.Archived };
    }
    if (query.categoryId && Types.ObjectId.isValid(query.categoryId)) {
      const categoryObjectId = new Types.ObjectId(query.categoryId);
      filter.$or = [
        { categoryId: categoryObjectId },
        { categoryIds: categoryObjectId },
        { categoryPath: categoryObjectId },
      ];
    }
    if (query.brandId && Types.ObjectId.isValid(query.brandId)) {
      filter.brandId = new Types.ObjectId(query.brandId);
    }
    if (query.search) {
      filter.titleNormalized = {
        $regex: escapeRegex(query.search.toLowerCase()),
        $options: 'i',
      };
    }
    const items = await this.productModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(query.limit ?? 200, 500))
      .lean()
      .exec();
    return { items: await this.enrichAdminListStock(items) };
  }

  private async enrichAdminListStock(
    items: Array<
      Record<string, unknown> & { _id?: Types.ObjectId; deliveryType?: string }
    >,
  ): Promise<Array<Record<string, unknown>>> {
    const ids = items
      .filter((item) => item._id)
      .map((item) => item._id as Types.ObjectId);

    const inventoryByProduct = new Map<string, number>();
    if (ids.length > 0) {
      const counts = await this.inventoryModel.aggregate<{
        _id: Types.ObjectId;
        count: number;
      }>([
        {
          $match: {
            productId: { $in: ids },
            status: InventoryStatus.Available,
          },
        },
        { $group: { _id: '$productId', count: { $sum: 1 } } },
      ]);
      for (const row of counts) {
        inventoryByProduct.set(String(row._id), row.count);
      }
    }

    return items.map((item) => {
      const inventoryAvailable =
        inventoryByProduct.get(String(item._id)) ?? 0;
      const effectiveAvailable = resolveProductAvailableStock(
        item,
        inventoryAvailable,
      );
      return {
        ...item,
        inventoryAvailable,
        effectiveAvailable,
      };
    });
  }

  async findByIdAdmin(id: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Product not found');
    }
    const product = await this.productModel.findById(id).lean().exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const enriched = await this.enrichAdminListStock([product]);
    return enriched[0] ?? product;
  }

  async list(query: QueryProductDto): Promise<ProductListResult> {
    // Cache public catalog queries that have no text search (search disables cache).
    const isPublicCacheable = !query.search;
    if (isPublicCacheable) {
      const cacheKey = CacheKeys.product.list(query);
      const cached = await this.cache.getJson<ProductListResult>(cacheKey);
      if (cached) return cached;

      const result = await this._listFromDb(query);
      await this.cache.setJson(cacheKey, result, PRODUCT_LIST_TTL);
      return result;
    }
    return this._listFromDb(query);
  }

  private async _listFromDb(query: QueryProductDto): Promise<ProductListResult> {
    const and: FilterQuery<ProductDocument>[] = [];
    const filter: FilterQuery<ProductDocument> = {
      status: ProductStatus.Active,
    };

    if (query.categoryId) {
      const categoryObjectId = new Types.ObjectId(query.categoryId);
      and.push({
        $or: [
          { categoryId: categoryObjectId },
          { categoryIds: categoryObjectId },
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
    if (query.type) {
      filter.type = query.type;
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const price: Record<string, number> = {};
      if (query.minPrice !== undefined) price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) price.$lte = query.maxPrice;
      filter['pricing.basePrice'] = price;
    }
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    const plan = this.resolveSort(query.sort);

    // Keyset pagination: (field, _id) compound cursor — avoids skip() on deep pages.
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      if (!cursor) {
        throw new BadRequestException('Invalid cursor');
      }
      const operator = plan.ascending ? '$gt' : '$lt';
      const value =
        plan.field === 'createdAt' ? new Date(cursor.v) : Number(cursor.v);
      const cursorId = new Types.ObjectId(cursor.id);
      and.push({
        $or: [
          { [plan.field]: { [operator]: value } },
          { [plan.field]: value, _id: { [operator]: cursorId } },
        ],
      } as FilterQuery<ProductDocument>);
    }

    if (and.length > 0) {
      filter.$and = and;
    }

    const direction: SortOrder = plan.ascending ? 1 : -1;
    const sort: Record<string, SortOrder> = {
      [plan.field]: direction,
      _id: direction,
    };

    const docs = await this.productModel
      .find(filter)
      .sort(sort)
      .limit(query.limit + 1)
      .select(LIST_PROJECTION)
      .lean()
      .exec();

    const hasMore = docs.length > query.limit;
    const page = hasMore ? docs.slice(0, query.limit) : docs;
    const last = page[page.length - 1];

    let nextCursor: string | null = null;
    if (hasMore && last) {
      const sortValue =
        plan.field === 'createdAt'
          ? (last.createdAt ?? new Date()).toISOString()
          : String(last.pricing?.basePrice ?? 0);
      nextCursor = encodeCursor({ v: sortValue, id: String(last._id) });
    }

    const items = await this.enrichListStock(page);

    return { items, nextCursor, limit: query.limit };
  }

  private async enrichListStock(
    items: Array<Record<string, unknown> & { _id?: Types.ObjectId; deliveryType?: string }>,
  ): Promise<Array<Record<string, unknown> & { inStock: boolean }>> {
    const inventoryProductIds = items
      .filter((item) => item._id && productUsesInventoryItems(item))
      .map((item) => item._id as Types.ObjectId);

    const inventoryByProduct = new Map<string, number>();
    if (inventoryProductIds.length > 0) {
      const counts = await this.inventoryModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            productId: { $in: inventoryProductIds },
            status: InventoryStatus.Available,
          },
        },
        { $group: { _id: '$productId', count: { $sum: 1 } } },
      ]);
      for (const row of counts) {
        inventoryByProduct.set(String(row._id), row.count);
      }
    }

    return items.map((item) => ({
      ...item,
      inStock: productHasPurchasableStock(
        item,
        inventoryByProduct.get(String(item._id)) ?? 0,
      ),
    }));
  }

  private resolveSort(sort: ProductSort): SortPlan {
    switch (sort) {
      case ProductSort.Oldest:
        return { field: 'createdAt', ascending: true };
      case ProductSort.PriceAsc:
        return { field: 'pricing.basePrice', ascending: true };
      case ProductSort.PriceDesc:
        return { field: 'pricing.basePrice', ascending: false };
      case ProductSort.Newest:
      default:
        return { field: 'createdAt', ascending: false };
    }
  }

  /**
   * Returns homepage category-product sections in a single aggregation round-trip.
   * Stock enrichment runs once for all products across categories.
   */
  async getHomepageSections(
    limitPerCategory = 6,
    featuredOnly?: boolean,
  ): Promise<
    Array<{
      category: { _id: string; name: string; slug: string; order: number };
      products: unknown[];
    }>
  > {
    const featured = featuredOnly ?? (await this.resolveHomepageFeaturedOnly());
    const CACHE_KEY = CacheKeys.product.homepageSections(limitPerCategory, featured);
    const cached = await this.cache.getJson<
      Array<{
        category: { _id: string; name: string; slug: string; order: number };
        products: unknown[];
      }>
    >(CACHE_KEY);
    if (cached) return cached;

    const categoryTree = await this.categories.getTree();
    const roots = [...categoryTree]
      .filter((c) => c.isActive !== false)
      .sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
      });

    if (roots.length === 0) {
      await this.cache.setJson(CACHE_KEY, [], PRODUCT_LIST_TTL);
      return [];
    }

    const facet: Record<string, PipelineStage.FacetPipelineStage[]> = {};
    for (const cat of roots) {
      const categoryObjectId = new Types.ObjectId(cat._id);
      const match: FilterQuery<ProductDocument> = {
        status: ProductStatus.Active,
        $or: [
          { categoryId: categoryObjectId },
          { categoryIds: categoryObjectId },
          { categoryPath: categoryObjectId },
        ],
      };
      if (featured) {
        match.featured = true;
      }
      facet[`cat_${cat._id}`] = [
        { $match: match },
        { $sort: { updatedAt: -1, _id: -1 } },
        { $limit: limitPerCategory },
        { $project: LIST_PROJECT_FIELDS },
      ];
    }

    const [facetResult] = await this.productModel
      .aggregate<{ [key: string]: Array<Record<string, unknown> & { _id?: Types.ObjectId; deliveryType?: string }> }>([
        { $facet: facet },
      ])
      .exec();

    const docsById = new Map<
      string,
      Record<string, unknown> & { _id?: Types.ObjectId; deliveryType?: string }
    >();
    const sectionDocs: Array<{
      category: { _id: string; name: string; slug: string; order: number };
      docs: Array<Record<string, unknown> & { _id?: Types.ObjectId; deliveryType?: string }>;
    }> = [];

    for (const cat of roots) {
      const docs = facetResult?.[`cat_${cat._id}`] ?? [];
      if (docs.length === 0) continue;
      for (const doc of docs) {
        docsById.set(String(doc._id), doc);
      }
      sectionDocs.push({
        category: {
          _id: cat._id,
          name: cat.name,
          slug: cat.slug,
          order: cat.order ?? 0,
        },
        docs,
      });
    }

    const enriched = await this.enrichListStock([...docsById.values()]);
    const enrichedById = new Map(
      enriched.map((item) => [String(item._id), item]),
    );

    const result = sectionDocs.map(({ category, docs }) => ({
      category,
      products: docs
        .map((doc) => enrichedById.get(String(doc._id)))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    }));

    await this.cache.setJson(CACHE_KEY, result, PRODUCT_LIST_TTL);
    return result;
  }

  private async resolveHomepageFeaturedOnly(): Promise<boolean> {
    const panel = await this.cache.getJson<{ homepageFeaturedOnly?: boolean }>(
      CacheKeys.settings.panel,
    );
    return panel?.homepageFeaturedOnly ?? false;
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = base || 'product';
    let candidate = root;
    let suffix = 1;
    while (true) {
      const existing = await this.productModel
        .findOne({ slug: candidate })
        .select('_id')
        .lean()
        .exec();
      if (!existing || (excludeId && String(existing._id) === excludeId)) {
        return candidate;
      }
      candidate = `${root}-${suffix++}`;
    }
  }
}
