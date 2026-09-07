import { DEFAULT_CURRENCY } from '@uniqbd/types';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { InventoryStatus, ProductStatus } from '../../common/enums';
import { round2 } from '../../common/utils/money';
import {
  lineRequiresAutoDeliveryPermission,
  resolveLineStock,
} from '../../common/utils/product-variation-stock';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../database/schemas/inventory-item.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import { CouponService } from '../coupons/coupon.service';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';
import { VoucherService } from '../vouchers/voucher.service';
import { AddItemDto } from './dto/add-item.dto';
import {
  CartCustomerInput,
  CartLineItem,
  CartView,
  StoredCart,
} from './cart.types';

const CART_TTL_SECONDS = CacheKeys.ttl.cart;

@Injectable()
export class CartService {
  constructor(
    private readonly cache: CacheService,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItemDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly coupons: CouponService,
    private readonly vouchers: VoucherService,
    private readonly rolePermissions: RolePermissionsService,
  ) {}

  async getCart(userId: string): Promise<CartView> {
    return this.buildView(userId, await this.load(userId));
  }

  async addItem(userId: string, dto: AddItemDto): Promise<CartView> {
    const cart = await this.load(userId);
    const variationValueId = dto.variationValueId?.trim() || undefined;
    const customerInputs = this.sanitizeCustomerInputs(dto.customerInputs);
    const product = await this.requirePurchasable(
      dto.productId,
      variationValueId,
    );
    await this.assertInstantDeliveryAccess(userId, product, variationValueId);
    const existing = cart.items.find(
      (i) =>
        i.productId === dto.productId &&
        (i.variationValueId ?? '') === (variationValueId ?? ''),
    );
    const line = await this.resolveLinePricing(product, variationValueId);
    const nextQty = (existing?.quantity ?? 0) + dto.quantity;
    if (nextQty > line.availableStock) {
      throw new BadRequestException('Insufficient stock');
    }
    if (existing) {
      existing.quantity = nextQty;
      if (customerInputs) {
        existing.customerInputs = customerInputs;
      }
    } else {
      cart.items.push({
        productId: dto.productId,
        quantity: dto.quantity,
        variationValueId,
        customerInputs,
      });
    }

    await this.save(userId, cart);
    return this.buildView(userId, cart);
  }

  async updateItem(
    userId: string,
    productId: string,
    quantity: number,
    variationValueId?: string,
  ): Promise<CartView> {
    const cart = await this.load(userId);
    const matches = this.lineMatcher(productId, variationValueId);
    if (quantity === 0) {
      cart.items = cart.items.filter((i) => !matches(i));
    } else {
      const existing = cart.items.find(matches);
      const product = await this.requirePurchasable(
        productId,
        existing?.variationValueId ?? variationValueId,
      );
      await this.assertInstantDeliveryAccess(
        userId,
        product,
        existing?.variationValueId ?? variationValueId,
      );
      const line = await this.resolveLinePricing(
        product,
        existing?.variationValueId ?? variationValueId,
      );
      if (quantity > line.availableStock) {
        throw new BadRequestException('Insufficient stock');
      }
      if (!existing) {
        cart.items.push({ productId, quantity, variationValueId });
      } else {
        existing.quantity = quantity;
      }
    }
    await this.save(userId, cart);
    return this.buildView(userId, cart);
  }

  async removeItem(
    userId: string,
    productId: string,
    variationValueId?: string,
  ): Promise<CartView> {
    const cart = await this.load(userId);
    const matches = this.lineMatcher(productId, variationValueId);
    cart.items = cart.items.filter((i) => !matches(i));
    await this.save(userId, cart);
    return this.buildView(userId, cart);
  }

  /**
   * Builds a predicate that targets a single cart line. When a variation id is
   * supplied it must match exactly, so distinct variations of the same product
   * are never confused. Without one, it falls back to matching by product id.
   */
  private lineMatcher(
    productId: string,
    variationValueId?: string,
  ): (item: { productId: string; variationValueId?: string }) => boolean {
    const variation = variationValueId?.trim() || undefined;
    if (variation === undefined) {
      return (item) => item.productId === productId;
    }
    return (item) =>
      item.productId === productId &&
      (item.variationValueId ?? '') === variation;
  }

  private sanitizeCustomerInputs(
    inputs?: CartCustomerInput[],
  ): CartCustomerInput[] | undefined {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return undefined;
    }
    const cleaned = inputs
      .map((i) => ({
        label: String(i.label ?? '').trim().slice(0, 120),
        value: String(i.value ?? '').trim().slice(0, 2000),
      }))
      .filter((i) => i.label.length > 0 && i.value.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  async clear(userId: string): Promise<CartView> {
    await this.cache.del(this.key(userId));
    return this.buildView(userId, this.empty());
  }

  async applyCoupon(userId: string, code: string): Promise<CartView> {
    const cart = await this.load(userId);
    const { subtotal } = await this.resolveItems(cart);
    const evaluation = await this.coupons.evaluate(code, subtotal, userId);
    if (!evaluation.valid) {
      throw new BadRequestException(evaluation.reason ?? 'Invalid coupon');
    }
    cart.couponCode = evaluation.code ?? code.toUpperCase();
    await this.save(userId, cart);
    return this.buildView(userId, cart);
  }

  async removeCoupon(userId: string): Promise<CartView> {
    const cart = await this.load(userId);
    delete cart.couponCode;
    await this.save(userId, cart);
    return this.buildView(userId, cart);
  }

  async applyVoucher(userId: string, code: string): Promise<CartView> {
    const cart = await this.load(userId);
    const evaluation = await this.vouchers.evaluate(code, userId);
    if (!evaluation.valid) {
      throw new BadRequestException(evaluation.reason ?? 'Invalid voucher');
    }
    cart.voucherCode = evaluation.code ?? code.toUpperCase();
    await this.save(userId, cart);
    return this.buildView(userId, cart);
  }

  async removeVoucher(userId: string): Promise<CartView> {
    const cart = await this.load(userId);
    delete cart.voucherCode;
    await this.save(userId, cart);
    return this.buildView(userId, cart);
  }

  // --- internals ---

  private key(userId: string): string {
    return CacheKeys.cart.user(userId);
  }

  private empty(): StoredCart {
    return { items: [], updatedAt: new Date().toISOString() };
  }

  private async load(userId: string): Promise<StoredCart> {
    const stored = await this.cache.getJson<StoredCart>(this.key(userId));
    return stored ?? this.empty();
  }

  private async save(userId: string, cart: StoredCart): Promise<void> {
    cart.updatedAt = new Date().toISOString();
    await this.cache.setJson(this.key(userId), cart, CART_TTL_SECONDS);
  }

  private async countInventoryAvailable(
    productId: string,
    variationValueId?: string,
  ): Promise<number> {
    const filter: FilterQuery<InventoryItemDocument> = {
      productId: new Types.ObjectId(productId),
      status: InventoryStatus.Available,
    };
    if (variationValueId?.trim()) {
      filter.variationValueId = variationValueId.trim();
    }
    return this.inventoryModel.countDocuments(filter);
  }

  /** Batch-fetch inventory counts for cart lines in a single aggregation. */
  private async batchInventoryCounts(
    keys: Array<{ productId: string; variationValueId?: string }>,
  ): Promise<Map<string, number>> {
    if (keys.length === 0) return new Map();

    const productIds = [
      ...new Set(keys.map((key) => key.productId)),
    ].map((id) => new Types.ObjectId(id));

    const rows = await this.inventoryModel
      .aggregate<{
        _id: { productId: Types.ObjectId; variationValueId?: string };
        count: number;
      }>([
        {
          $match: {
            productId: { $in: productIds },
            status: InventoryStatus.Available,
          },
        },
        {
          $group: {
            _id: {
              productId: '$productId',
              variationValueId: '$variationValueId',
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const counts = new Map<string, number>();
    for (const key of keys) {
      const cacheKey = `${key.productId}:${key.variationValueId ?? ''}`;
      if (counts.has(cacheKey)) continue;
      const total = rows
        .filter((row) => {
          if (String(row._id.productId) !== key.productId) return false;
          const rowVariation = row._id.variationValueId?.trim() ?? '';
          const keyVariation = key.variationValueId?.trim() ?? '';
          return rowVariation === keyVariation;
        })
        .reduce((sum, row) => sum + row.count, 0);
      counts.set(cacheKey, total);
    }
    return counts;
  }

  private inventoryCacheKey(
    productId: string,
    variationValueId?: string,
  ): string {
    return `${productId}:${variationValueId?.trim() ?? ''}`;
  }

  private async resolveAvailableStock(
    product: {
      _id: Types.ObjectId | string;
      deliveryType?: string;
      stock?: { available?: number };
      attributes?: Record<string, unknown>;
    },
    variationValueId?: string,
    inventoryCache?: Map<string, number>,
  ): Promise<number> {
    const stock = resolveLineStock(product, variationValueId);
    if (stock.manualVariation) {
      return stock.availableStock;
    }
    if (stock.usesInventory) {
      const cacheKey = this.inventoryCacheKey(
        String(product._id),
        stock.variationValueId ?? variationValueId,
      );
      if (inventoryCache?.has(cacheKey)) return inventoryCache.get(cacheKey)!;
      return this.countInventoryAvailable(
        String(product._id),
        stock.variationValueId ?? variationValueId,
      );
    }
    return stock.availableStock;
  }

  private async resolveLinePricing(
    product: {
      _id: Types.ObjectId | string;
      deliveryType?: string;
      title?: string;
      pricing?: { basePrice?: number };
      stock?: { available?: number };
      media?: Array<{ url?: string }>;
      attributes?: Record<string, unknown>;
    },
    variationValueId?: string,
    inventoryCache?: Map<string, number>,
  ): Promise<{
    unitPrice: number;
    packageName?: string;
    availableStock: number;
    thumbnail?: string;
  }> {
    const availableStock = await this.resolveAvailableStock(
      product,
      variationValueId,
      inventoryCache,
    );
    const base = {
      unitPrice: product.pricing?.basePrice ?? 0,
      availableStock,
      thumbnail: product.media?.[0]?.url,
    };
    if (!variationValueId) {
      return base;
    }

    const raw = product.attributes?.variations;
    if (!Array.isArray(raw)) {
      return base;
    }

    const variation = raw.find(
      (row) =>
        String((row as { valueId?: string }).valueId ?? '') === variationValueId,
    ) as
      | {
          name?: string;
          price?: number;
          imageUrl?: string;
        }
      | undefined;

    if (!variation) {
      return base;
    }

    return {
      unitPrice: Number(variation.price ?? base.unitPrice),
      packageName: variation.name ? String(variation.name) : undefined,
      availableStock,
      thumbnail: variation.imageUrl
        ? String(variation.imageUrl)
        : base.thumbnail,
    };
  }

  private async assertInstantDeliveryAccess(
    userId: string,
    product: ProductDocument,
    variationValueId?: string,
  ): Promise<void> {
    if (!lineRequiresAutoDeliveryPermission(product, variationValueId)) {
      return;
    }
    const user = await this.userModel.findById(userId).select('roles').lean().exec();
    if (!user?.roles?.length) {
      throw new ForbiddenException(
        'Instant delivery products require auto delivery access',
      );
    }
    const allowed = await this.rolePermissions.rolesHavePermission(
      user.roles,
      'auto_delivery',
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Instant delivery products require auto delivery access',
      );
    }
  }

  private async requirePurchasable(
    productId: string,
    variationValueId?: string,
  ): Promise<ProductDocument> {
    const product = await this.productModel.findById(productId).exec();
    if (!product || product.status !== ProductStatus.Active) {
      throw new BadRequestException('Product is not available');
    }
    const availableStock = await this.resolveAvailableStock(
      product,
      variationValueId,
    );
    if (availableStock <= 0) {
      throw new BadRequestException(
        variationValueId
          ? 'Selected package is out of stock'
          : 'Product is out of stock',
      );
    }
    return product;
  }

  /**
   * Rebuilds priced line items from the latest product data, clamping
   * quantities to current stock and dropping unavailable products.
   */
  private async resolveItems(cart: StoredCart): Promise<{
    lineItems: CartLineItem[];
    subtotal: number;
    currency: string;
    changed: boolean;
  }> {
    if (cart.items.length === 0) {
      return {
        lineItems: [],
        subtotal: 0,
        currency: DEFAULT_CURRENCY,
        changed: false,
      };
    }

    const ids = cart.items.map((i) => new Types.ObjectId(i.productId));
    const products = await this.productModel
      .find({ _id: { $in: ids }, status: ProductStatus.Active })
      .select('title slug pricing stock media attributes deliveryType')
      .lean()
      .exec();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const inventoryKeys = cart.items.flatMap((item) => {
      const product = byId.get(item.productId);
      if (!product) return [];
      const stock = resolveLineStock(product, item.variationValueId);
      if (!stock.usesInventory) return [];
      const variationValueId = stock.variationValueId ?? item.variationValueId;
      return [
        {
          productId: item.productId,
          ...(variationValueId ? { variationValueId } : {}),
        },
      ];
    });
    const inventoryCache = await this.batchInventoryCounts(inventoryKeys);

    const lineItems: CartLineItem[] = [];
    const nextItems: StoredCart['items'] = [];
    let changed = false;
    let currency: string = DEFAULT_CURRENCY;

    for (const item of cart.items) {
      const product = byId.get(item.productId);
      if (!product) {
        changed = true;
        continue;
      }
      const line = await this.resolveLinePricing(
        product,
        item.variationValueId,
        inventoryCache,
      );
      if (line.availableStock <= 0) {
        changed = true;
        continue;
      }
      let quantity = item.quantity;
      if (quantity > line.availableStock) {
        quantity = line.availableStock;
        changed = true;
      }
      const unitPrice = line.unitPrice;
      currency = product.pricing?.currency ?? currency;
      lineItems.push({
        productId: item.productId,
        title: product.title,
        slug: product.slug,
        packageName: line.packageName,
        variationValueId: item.variationValueId,
        customerInputs: item.customerInputs,
        unitPrice,
        quantity,
        lineTotal: round2(unitPrice * quantity),
        thumbnail: line.thumbnail ?? product.media?.[0]?.url,
        availableStock: line.availableStock,
      });
      nextItems.push({
        productId: item.productId,
        quantity,
        variationValueId: item.variationValueId,
        customerInputs: item.customerInputs,
      });
    }

    cart.items = nextItems;
    const subtotal = round2(
      lineItems.reduce((sum, li) => sum + li.lineTotal, 0),
    );
    return { lineItems, subtotal, currency, changed };
  }

  private async buildView(
    userId: string,
    cart: StoredCart,
  ): Promise<CartView> {
    const { lineItems, subtotal, currency, changed } =
      await this.resolveItems(cart);

    let couponDiscount = 0;
    let coupon: CartView['coupon'] = null;
    if (cart.couponCode) {
      const evaluation = await this.coupons.evaluate(
        cart.couponCode,
        subtotal,
        userId,
      );
      couponDiscount = evaluation.discount;
      coupon = {
        code: cart.couponCode,
        discount: evaluation.discount,
        valid: evaluation.valid,
        reason: evaluation.reason,
      };
    }

    let voucherDiscount = 0;
    let voucher: CartView['voucher'] = null;
    if (cart.voucherCode) {
      const evaluation = await this.vouchers.evaluate(
        cart.voucherCode,
        userId,
      );
      voucherDiscount = evaluation.valid
        ? round2(Math.min(evaluation.amount, Math.max(0, subtotal - couponDiscount)))
        : 0;
      voucher = {
        code: cart.voucherCode,
        amount: evaluation.amount,
        applied: voucherDiscount,
        valid: evaluation.valid,
        reason: evaluation.reason,
      };
    }

    const discountTotal = round2(couponDiscount + voucherDiscount);
    const total = round2(Math.max(0, subtotal - discountTotal));

    if (changed) {
      await this.save(userId, cart);
    }

    return {
      items: lineItems,
      subtotal,
      coupon,
      voucher,
      discountTotal,
      total,
      currency,
    };
  }
}
