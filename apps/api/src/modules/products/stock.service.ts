import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { InventoryStatus, ProductStatus } from '../../common/enums';
import { escapeRegex } from '../../common/utils/escape-regex';
import { variationUsesInventoryPackage } from '../../common/utils/product-variation-stock';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../database/schemas/inventory-item.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';

export interface StockOverview {
  available: number;
  reserved: number;
  sold: number;
}

export interface PackageStockOverview {
  valueId: string;
  name: string;
  stockType: string;
  available: number;
  reserved: number;
  sold: number;
}

export const UNASSIGNED_INVENTORY_SCOPE = '__unassigned__';

export interface StockDetail extends StockOverview {
  packages?: PackageStockOverview[];
  /** Legacy codes added before package tagging (gift card / API products only). */
  unassigned?: StockOverview;
}

export interface InventoryListItem {
  id: string;
  value: string;
  status: InventoryStatus;
  cost?: number;
  createdAt?: Date;
}

export interface InventoryListResult {
  items: InventoryListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AddInventoryResult {
  added: number;
  skipped: number;
  duplicates: string[];
  available: number;
}

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItemDocument>,
    private readonly cache: CacheService,
  ) {}

  private async invalidateProductCache(slug?: string): Promise<void> {
    if (slug) await this.cache.del(CacheKeys.product.detail(slug));
    await Promise.all([
      this.cache.delByPrefix(CacheKeys.product.listPrefix),
      this.cache.delByPrefix(CacheKeys.product.homepageSectionsPrefix),
    ]);
  }

  /** Bulk-add deliverable units and increment the cached available count. */
  async addInventory(
    productId: string,
    values: string[],
    cost?: number,
    variationValueId?: string,
  ): Promise<AddInventoryResult> {
    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let normalizedVariationId = variationValueId?.trim() || undefined;
    if (normalizedVariationId) {
      const packages = this.inventoryPackages(product);
      if (packages.length > 0) {
        const resolved = this.resolvePackageValueId(
          packages,
          normalizedVariationId,
        );
        if (
          resolved &&
          !packages.some((pkg) => this.valueIdMatches(pkg.valueId, resolved))
        ) {
          throw new BadRequestException('Invalid package for this product');
        }
        normalizedVariationId = resolved;
      }
    }

    const { uniqueValues, batchDuplicates } =
      this.prepareInventoryValues(values);
    if (uniqueValues.length === 0) {
      throw new BadRequestException('Add at least one deliverable value');
    }

    const productObjectId = new Types.ObjectId(productId);
    const existingValues = await this.findExistingInventoryValues(
      productObjectId,
      uniqueValues,
    );
    const duplicates = [
      ...batchDuplicates,
      ...uniqueValues.filter((value) => existingValues.has(value)),
    ];
    const valuesToInsert = uniqueValues.filter(
      (value) => !existingValues.has(value),
    );

    const docs = valuesToInsert.map((value) => ({
      productId: productObjectId,
      value,
      cost,
      status: InventoryStatus.Available,
      ...(normalizedVariationId
        ? { variationValueId: normalizedVariationId }
        : {}),
    }));

    let insertedCount = 0;
    if (docs.length > 0) {
      const inserted = await this.inventoryModel.insertMany(docs, {
        ordered: true,
      });
      insertedCount = inserted.length;
    }

    const updated =
      insertedCount > 0
        ? await this.productModel
            .findByIdAndUpdate(
              productId,
              {
                $inc: { 'stock.available': insertedCount },
                ...(product.status === ProductStatus.OutOfStock
                  ? { $set: { status: ProductStatus.Active } }
                  : {}),
              },
              { new: true },
            )
            .exec()
        : product;

    await this.invalidateProductCache(product.slug);

    return {
      added: insertedCount,
      skipped: duplicates.length,
      duplicates,
      available: updated?.stock.available ?? 0,
    };
  }

  private normalizeInventoryValue(value: string): string {
    return value.trim();
  }

  private prepareInventoryValues(values: string[]): {
    uniqueValues: string[];
    batchDuplicates: string[];
  } {
    const uniqueValues: string[] = [];
    const seen = new Set<string>();
    const batchDuplicates: string[] = [];

    for (const raw of values) {
      const normalized = this.normalizeInventoryValue(raw);
      if (!normalized) continue;
      if (seen.has(normalized)) {
        batchDuplicates.push(normalized);
        continue;
      }
      seen.add(normalized);
      uniqueValues.push(normalized);
    }

    return { uniqueValues, batchDuplicates };
  }

  private async findExistingInventoryValues(
    productId: Types.ObjectId,
    candidates: string[],
  ): Promise<Set<string>> {
    if (candidates.length === 0) {
      return new Set();
    }

    const rows = await this.inventoryModel.aggregate<{ _id: string }>([
      { $match: { productId } },
      {
        $project: {
          value: {
            $trim: {
              input: { $ifNull: ['$value', ''] },
            },
          },
        },
      },
      { $match: { value: { $in: candidates } } },
      { $group: { _id: '$value' } },
    ]);

    return new Set(
      rows
        .map((row) => this.normalizeInventoryValue(String(row._id ?? '')))
        .filter(Boolean),
    );
  }

  private async assertInventoryValueAvailable(
    productId: Types.ObjectId,
    value: string,
    excludeItemId?: Types.ObjectId,
  ): Promise<void> {
    const normalized = this.normalizeInventoryValue(value);
    if (!normalized) {
      throw new BadRequestException('Code value is required');
    }

    const matchStage: FilterQuery<InventoryItemDocument> = { productId };
    if (excludeItemId) {
      matchStage._id = { $ne: excludeItemId };
    }

    const rows = await this.inventoryModel.aggregate<{ _id: Types.ObjectId }>([
      { $match: matchStage },
      {
        $project: {
          value: {
            $trim: {
              input: { $ifNull: ['$value', ''] },
            },
          },
        },
      },
      { $match: { value: normalized } },
      { $limit: 1 },
      { $project: { _id: 1 } },
    ]);

    if (rows.length > 0) {
      throw new BadRequestException(
        'This code already exists in product inventory',
      );
    }
  }

  private async requireProduct(productId: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private editableStatuses(): InventoryStatus[] {
    return [InventoryStatus.Available, InventoryStatus.Disabled];
  }

  private valueIdMatches(a: string, b: string): boolean {
    if (a === b) return true;
    const na = Number(a);
    const nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
  }

  /** Map an order/cart variation id to the canonical package valueId when possible. */
  private resolvePackageValueId(
    packages: Array<{ valueId: string }>,
    variationValueId?: string,
  ): string | undefined {
    const normalized = variationValueId?.trim();
    if (!normalized) return undefined;
    const match = packages.find((pkg) =>
      this.valueIdMatches(pkg.valueId, normalized),
    );
    return match?.valueId ?? normalized;
  }

  private inventoryPackages(product: ProductDocument): Array<{
    valueId: string;
    name: string;
    stockType: string;
  }> {
    const raw = product.attributes?.variations;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        const variation = row as {
          valueId?: string | number;
          name?: string;
          stockType?: string;
        };
        if (!variationUsesInventoryPackage(variation)) return null;
        const valueId = String(variation.valueId ?? '').trim();
        if (!valueId) return null;
        const stockType = variation.stockType ?? 'manual';
        return {
          valueId,
          name: String(variation.name ?? `Package ${valueId}`),
          stockType,
        };
      })
      .filter((row): row is { valueId: string; name: string; stockType: string } =>
        Boolean(row),
      );
  }

  private variationInventoryFilter(
    productId: Types.ObjectId,
    variationValueId?: string,
  ): FilterQuery<InventoryItemDocument> {
    const filter: FilterQuery<InventoryItemDocument> = { productId };
    if (variationValueId?.trim()) {
      filter.variationValueId = variationValueId.trim();
    }
    return filter;
  }

  private variationIdFilter(
    variationValueId: string,
  ): FilterQuery<InventoryItemDocument>['variationValueId'] {
    const candidates = new Set<string | number>([variationValueId]);
    const numeric = Number(variationValueId);
    if (Number.isFinite(numeric)) {
      candidates.add(numeric);
    }
    return { $in: [...candidates] };
  }

  private unassignedInventoryFilter(
    productId: Types.ObjectId,
    packageIds: string[],
  ): FilterQuery<InventoryItemDocument> {
    const validIds = packageIds.filter(Boolean);
    return {
      productId,
      $or: [
        { variationValueId: { $exists: false } },
        { variationValueId: null },
        { variationValueId: '' },
        ...(validIds.length > 0
          ? [{ variationValueId: { $nin: validIds } }]
          : []),
      ],
    };
  }

  private async countUnassigned(
    productId: Types.ObjectId,
    packageIds: string[],
  ): Promise<StockOverview> {
    const match = this.unassignedInventoryFilter(productId, packageIds);
    const grouped = await this.inventoryModel
      .aggregate<{ _id: InventoryStatus; count: number }>([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    const counts: StockOverview = { available: 0, reserved: 0, sold: 0 };
    for (const row of grouped) {
      if (row._id === InventoryStatus.Available) counts.available = row.count;
      else if (row._id === InventoryStatus.Reserved) counts.reserved = row.count;
      else if (row._id === InventoryStatus.Sold) counts.sold = row.count;
    }
    return counts;
  }

  private async countByVariation(
    productId: Types.ObjectId,
    variationValueId?: string,
  ): Promise<StockOverview> {
    const match: FilterQuery<InventoryItemDocument> = {
      productId,
    };
    if (variationValueId?.trim()) {
      match.variationValueId = variationValueId.trim();
    }

    const grouped = await this.inventoryModel
      .aggregate<{ _id: InventoryStatus; count: number }>([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    const counts: StockOverview = { available: 0, reserved: 0, sold: 0 };
    for (const row of grouped) {
      if (row._id === InventoryStatus.Available) counts.available = row.count;
      else if (row._id === InventoryStatus.Reserved) counts.reserved = row.count;
      else if (row._id === InventoryStatus.Sold) counts.sold = row.count;
    }
    return counts;
  }

  async listInventory(
    productId: string,
    query: {
      status?: string;
      page?: number;
      limit?: number;
      variationValueId?: string;
      search?: string;
    },
  ): Promise<InventoryListResult> {
    const product = await this.requireProduct(productId);
    const packages = this.inventoryPackages(product);
    const requestedVariationId = query.variationValueId?.trim();
    const productObjectId = new Types.ObjectId(productId);

    let scopedVariationId = requestedVariationId;
    if (packages.length > 0) {
      if (!scopedVariationId) {
        return { items: [], total: 0, page: 1, limit: query.limit ?? 50 };
      }
      if (scopedVariationId !== UNASSIGNED_INVENTORY_SCOPE) {
        scopedVariationId = this.resolvePackageValueId(
          packages,
          scopedVariationId,
        );
      }
    }

    const filter: FilterQuery<InventoryItemDocument> =
      scopedVariationId === UNASSIGNED_INVENTORY_SCOPE
        ? {
            ...this.unassignedInventoryFilter(
              productObjectId,
              packages.map((pkg) => pkg.valueId),
            ),
          }
        : { productId: productObjectId };
    if (
      scopedVariationId &&
      scopedVariationId !== UNASSIGNED_INVENTORY_SCOPE
    ) {
      filter.variationValueId = this.variationIdFilter(scopedVariationId);
    }

    const searchTerm = query.search?.trim();
    if (searchTerm) {
      filter.value = {
        $regex: escapeRegex(searchTerm),
        $options: 'i',
      };
    } else if (
      query.status &&
      Object.values(InventoryStatus).includes(query.status as InventoryStatus)
    ) {
      filter.status = query.status as InventoryStatus;
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.inventoryModel
        .find(filter)
        .select('+value')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.inventoryModel.countDocuments(filter).exec(),
    ]);

    return {
      items: rows.map((row) => ({
        id: String(row._id),
        value: row.value,
        status: row.status,
        cost: row.cost,
        createdAt: row.createdAt,
        soldAt: row.soldAt,
      })),
      total,
      page,
      limit,
    };
  }

  async updateInventoryItem(
    productId: string,
    itemId: string,
    dto: { value?: string; cost?: number },
  ): Promise<InventoryListItem> {
    const product = await this.requireProduct(productId);
    if (!Types.ObjectId.isValid(itemId)) {
      throw new NotFoundException('Inventory item not found');
    }

    const item = await this.inventoryModel
      .findOne({ _id: itemId, productId: product._id })
      .select('+value')
      .exec();
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    if (!this.editableStatuses().includes(item.status)) {
      throw new BadRequestException(
        'Only available or disabled codes can be edited',
      );
    }

    if (dto.value !== undefined) {
      const nextValue = this.normalizeInventoryValue(dto.value);
      if (nextValue !== this.normalizeInventoryValue(item.value)) {
        await this.assertInventoryValueAvailable(
          product._id as Types.ObjectId,
          nextValue,
          item._id as Types.ObjectId,
        );
      }
      item.value = nextValue;
    }
    if (dto.cost !== undefined) {
      item.cost = dto.cost;
    }
    await item.save();
    await this.invalidateProductCache(product.slug);

    return {
      id: String(item._id),
      value: item.value,
      status: item.status,
      cost: item.cost,
      createdAt: item.createdAt,
    };
  }

  async deleteInventoryItem(
    productId: string,
    itemId: string,
  ): Promise<StockOverview> {
    const product = await this.requireProduct(productId);
    if (!Types.ObjectId.isValid(itemId)) {
      throw new NotFoundException('Inventory item not found');
    }

    const item = await this.inventoryModel
      .findOne({ _id: itemId, productId: product._id })
      .exec();
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    if (!this.editableStatuses().includes(item.status)) {
      throw new BadRequestException(
        'Only available or disabled codes can be deleted',
      );
    }

    await this.inventoryModel.deleteOne({ _id: item._id }).exec();
    const counts = await this.recalculate(productId);

    if (counts.available > 0 && product.status === ProductStatus.OutOfStock) {
      await this.productModel
        .updateOne(
          { _id: product._id },
          { $set: { status: ProductStatus.Active } },
        )
        .exec();
    }

    return counts;
  }

  async deleteUnassignedInventory(
    productId: string,
  ): Promise<{ deleted: number } & StockOverview> {
    const product = await this.requireProduct(productId);
    const packages = this.inventoryPackages(product);
    if (packages.length === 0) {
      throw new BadRequestException(
        'This product does not use package-based inventory',
      );
    }

    const productObjectId = new Types.ObjectId(productId);
    const baseFilter = this.unassignedInventoryFilter(
      productObjectId,
      packages.map((pkg) => pkg.valueId),
    );
    const result = await this.inventoryModel
      .deleteMany({
        ...baseFilter,
        status: { $in: this.editableStatuses() },
      })
      .exec();

    const counts = await this.recalculate(productId);
    return { deleted: result.deletedCount ?? 0, ...counts };
  }

  async getStock(
    productId: string,
    variationValueId?: string,
  ): Promise<StockDetail> {
    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const packages = this.inventoryPackages(product);
    const productObjectId = new Types.ObjectId(productId);

    if (variationValueId?.trim()) {
      const scoped = await this.countByVariation(
        productObjectId,
        variationValueId,
      );
      return scoped;
    }

    const totals: StockDetail = {
      available: 0,
      reserved: 0,
      sold: 0,
    };

    if (packages.length > 0) {
      const rows = await this.inventoryModel
        .aggregate<{
          _id: { variationValueId?: string; status: InventoryStatus };
          count: number;
        }>([
          { $match: { productId: productObjectId } },
          {
            $group: {
              _id: {
                variationValueId: '$variationValueId',
                status: '$status',
              },
              count: { $sum: 1 },
            },
          },
        ])
        .exec();

      const byPackage = new Map<
        string,
        { available: number; reserved: number; sold: number }
      >();
      for (const pkg of packages) {
        byPackage.set(pkg.valueId, { available: 0, reserved: 0, sold: 0 });
      }

      for (const row of rows) {
        const rawValueId = row._id.variationValueId;
        if (rawValueId == null || rawValueId === '') continue;
        const normalized = String(rawValueId).trim();
        const pkg = packages.find((entry) =>
          this.valueIdMatches(entry.valueId, normalized),
        );
        if (!pkg) continue;
        const entry = byPackage.get(pkg.valueId)!;
        if (row._id.status === InventoryStatus.Available) {
          entry.available = row.count;
        } else if (row._id.status === InventoryStatus.Reserved) {
          entry.reserved = row.count;
        } else if (row._id.status === InventoryStatus.Sold) {
          entry.sold = row.count;
        }
      }

      totals.packages = packages.map((pkg) => ({
        ...pkg,
        ...byPackage.get(pkg.valueId)!,
      }));
      totals.available = totals.packages.reduce(
        (sum, pkg) => sum + pkg.available,
        0,
      );
      totals.reserved = totals.packages.reduce(
        (sum, pkg) => sum + pkg.reserved,
        0,
      );
      totals.sold = totals.packages.reduce((sum, pkg) => sum + pkg.sold, 0);
      totals.unassigned = await this.countUnassigned(
        productObjectId,
        packages.map((pkg) => pkg.valueId),
      );
      return totals;
    }

    return {
      available: product.stock?.available ?? 0,
      reserved: product.stock?.reserved ?? 0,
      sold: product.stock?.sold ?? 0,
    };
  }

  /** Recomputes the cached counts from inventory_items (reconciliation job). */
  async recalculate(productId: string): Promise<StockOverview> {
    const productObjectId = new Types.ObjectId(productId);
    const grouped = await this.inventoryModel
      .aggregate<{ _id: InventoryStatus; count: number }>([
        { $match: { productId: productObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    const counts: StockOverview = { available: 0, reserved: 0, sold: 0 };
    for (const row of grouped) {
      if (row._id === InventoryStatus.Available) counts.available = row.count;
      else if (row._id === InventoryStatus.Reserved) counts.reserved = row.count;
      else if (row._id === InventoryStatus.Sold) counts.sold = row.count;
    }

    await this.productModel
      .updateOne({ _id: productObjectId }, { $set: { stock: counts } })
      .exec();

    const product = await this.productModel
      .findById(productObjectId)
      .select('slug')
      .lean()
      .exec();
    await this.invalidateProductCache(product?.slug);

    return counts;
  }
}
