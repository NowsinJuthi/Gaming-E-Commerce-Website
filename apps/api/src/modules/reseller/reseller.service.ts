import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { ProductStatus, ResellerStatus } from '../../common/enums';
import { round2 } from '../../common/utils/money';
import { escapeRegex } from '../../common/utils/escape-regex';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import {
  ResellerApiKey,
  ResellerApiKeyDocument,
} from '../../database/schemas/reseller-api-key.schema';
import {
  ResellerPrice,
  ResellerPriceDocument,
} from '../../database/schemas/reseller-price.schema';
import {
  Reseller,
  ResellerDocument,
} from '../../database/schemas/reseller.schema';
import type { WalletDocument } from '../../database/schemas/wallet.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { WalletService } from '../wallet/wallet.service';
import { ApplyResellerDto } from './dto/apply-reseller.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { TopUpDto } from './dto/topup.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';

const API_KEY_PREFIX = 'rsk_';

const hashKey = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex');

@Injectable()
export class ResellerService {
  constructor(
    @InjectModel(Reseller.name)
    private readonly resellerModel: Model<ResellerDocument>,
    @InjectModel(ResellerPrice.name)
    private readonly priceModel: Model<ResellerPriceDocument>,
    @InjectModel(ResellerApiKey.name)
    private readonly apiKeyModel: Model<ResellerApiKeyDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly wallet: WalletService,
  ) {}

  // --- Account lifecycle ---

  async apply(
    user: AuthenticatedUser,
    dto: ApplyResellerDto,
  ): Promise<ResellerDocument> {
    const existing = await this.resellerModel
      .findOne({ userId: new Types.ObjectId(user.id) })
      .exec();
    if (existing) {
      throw new ConflictException('A reseller application already exists');
    }
    return this.resellerModel.create({
      userId: new Types.ObjectId(user.id),
      companyName: dto.companyName,
    });
  }

  async getMine(user: AuthenticatedUser): Promise<ResellerDocument> {
    const reseller = await this.resellerModel
      .findOne({ userId: new Types.ObjectId(user.id) })
      .exec();
    if (!reseller) {
      throw new NotFoundException('You are not registered as a reseller');
    }
    return reseller;
  }

  /** Resolves the active reseller for a user or throws (dashboard guard). */
  async requireActive(user: AuthenticatedUser): Promise<ResellerDocument> {
    const reseller = await this.getMine(user);
    if (reseller.status !== ResellerStatus.Active) {
      throw new ForbiddenException('Reseller account is not active');
    }
    return reseller;
  }

  async incrementOrderStats(
    resellerId: Types.ObjectId,
    amount: number,
  ): Promise<void> {
    await this.resellerModel
      .updateOne(
        { _id: resellerId },
        { $inc: { totalOrders: 1, totalSpent: round2(amount) } },
      )
      .exec();
  }

  async getById(resellerId: string): Promise<ResellerDocument> {
    const reseller = await this.resellerModel.findById(resellerId).exec();
    if (!reseller) {
      throw new NotFoundException('Reseller not found');
    }
    return reseller;
  }

  async adminList(
    pagination: PaginationDto,
    status?: ResellerStatus,
    q?: string,
  ): Promise<
    PaginatedResult<{
      _id: string;
      userId: string;
      email?: string;
      displayName?: string;
      companyName: string;
      status: ResellerStatus;
      tier: string;
      discountRate: number;
      totalOrders: number;
      totalSpent: number;
      balance: number;
      currency: string;
      createdAt?: Date;
    }>
  > {
    const filter: FilterQuery<ResellerDocument> = {};
    if (status) {
      filter.status = status;
    }
    if (q?.trim()) {
      filter.companyName = { $regex: escapeRegex(q.trim()), $options: 'i' };
    }
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.resellerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<{ userId: UserDocument }>('userId', 'email profile.displayName')
        .exec(),
      this.resellerModel.countDocuments(filter).exec(),
    ]);
    const rows = await Promise.all(
      items.map(async (r) => {
        const user =
          r.userId && typeof r.userId === 'object' ? r.userId : null;
        const wallet = await this.wallet.getWallet(
          user ? String(user._id) : String(r.userId),
        );
        return {
          _id: String(r._id),
          userId: user ? String(user._id) : String(r.userId),
          email: user?.email,
          displayName: user?.profile?.displayName,
          companyName: r.companyName,
          status: r.status,
          tier: r.tier,
          discountRate: r.discountRate,
          totalOrders: r.totalOrders,
          totalSpent: r.totalSpent,
          balance: wallet.balance,
          currency: wallet.currency,
          createdAt: r.createdAt,
        };
      }),
    );
    return { items: rows, total, page, limit };
  }

  async adminOverview(): Promise<{
    resellers: { total: number; pending: number; active: number; suspended: number };
    wholesale: { orders: number; spent: number };
    apiKeys: { active: number };
    tiers: string[];
    defaultDiscountRate: number;
    apiBaseUrl: string;
  }> {
    const [total, pending, active, suspended, agg, apiKeys] =
      await Promise.all([
        this.resellerModel.countDocuments().exec(),
        this.resellerModel
          .countDocuments({ status: ResellerStatus.Pending })
          .exec(),
        this.resellerModel
          .countDocuments({ status: ResellerStatus.Active })
          .exec(),
        this.resellerModel
          .countDocuments({ status: ResellerStatus.Suspended })
          .exec(),
        this.resellerModel
          .aggregate<{ orders: number; spent: number }>([
            {
              $group: {
                _id: null,
                orders: { $sum: '$totalOrders' },
                spent: { $sum: '$totalSpent' },
              },
            },
          ])
          .exec(),
        this.apiKeyModel
          .countDocuments({ revokedAt: { $exists: false } })
          .exec(),
      ]);
    const stats = agg[0] ?? { orders: 0, spent: 0 };
    return {
      resellers: { total, pending, active, suspended },
      wholesale: { orders: stats.orders, spent: round2(stats.spent) },
      apiKeys: { active: apiKeys },
      tiers: ['standard', 'silver', 'gold', 'platinum'],
      defaultDiscountRate: 0.1,
      apiBaseUrl: '/api/reseller/api',
    };
  }

  async getCatalog(reseller: ResellerDocument): Promise<
    Array<{
      productId: string;
      title: string;
      slug: string;
      basePrice: number;
      wholesalePrice: number;
      currency: string;
      available: number;
      hasOverride: boolean;
    }>
  > {
    const products = await this.productModel
      .find({ status: ProductStatus.Active })
      .sort({ title: 1 })
      .limit(200)
      .exec();
    const overrides = await this.getPriceOverrides(
      reseller._id,
      products.map((p) => p._id),
    );
    return products.map((product) => {
      const productId = String(product._id);
      const override = overrides.get(productId);
      return {
        productId,
        title: product.title,
        slug: product.slug,
        basePrice: product.pricing.basePrice,
        wholesalePrice: this.resolveUnitPrice(reseller, product, override),
        currency: product.pricing.currency,
        available: product.stock?.available ?? 0,
        hasOverride: override !== undefined,
      };
    });
  }

  adminListApiKeys(resellerId: string): Promise<ResellerApiKeyDocument[]> {
    return this.apiKeyModel
      .find({ resellerId: new Types.ObjectId(resellerId) })
      .select('-hash')
      .sort({ createdAt: -1 })
      .exec();
  }

  async adminUpdate(
    resellerId: string,
    dto: UpdateResellerDto,
  ): Promise<ResellerDocument> {
    const reseller = await this.getById(resellerId);
    if (dto.status !== undefined) {
      reseller.status = dto.status;
    }
    if (dto.tier !== undefined) {
      reseller.tier = dto.tier;
    }
    if (dto.discountRate !== undefined) {
      reseller.discountRate = dto.discountRate;
    }
    await reseller.save();
    return reseller;
  }

  // --- Balance ---

  async getBalance(user: AuthenticatedUser): Promise<WalletDocument> {
    await this.getMine(user);
    return this.wallet.getWallet(user.id);
  }

  async adminTopUp(
    resellerId: string,
    dto: TopUpDto,
  ): Promise<WalletDocument> {
    const reseller = await this.getById(resellerId);
    await this.wallet.deposit({
      userId: reseller.userId,
      amount: dto.amount,
      reference: { type: 'reseller_topup', id: reseller._id },
      description: dto.note ?? 'Reseller balance top-up',
    });
    return this.wallet.getWallet(String(reseller.userId));
  }

  // --- Custom pricing ---

  async setPrice(
    resellerId: string,
    dto: SetPriceDto,
  ): Promise<ResellerPriceDocument> {
    const product = await this.productModel.findById(dto.productId).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const filter = {
      resellerId: new Types.ObjectId(resellerId),
      productId: new Types.ObjectId(dto.productId),
    };
    const update = {
      unitPrice: round2(dto.unitPrice),
      currency: dto.currency ?? product.pricing.currency,
      active: true,
    };
    const price = await this.priceModel
      .findOneAndUpdate(filter, { $set: update }, { new: true, upsert: true })
      .exec();
    if (!price) {
      throw new BadRequestException('Could not save price');
    }
    return price;
  }

  async removePrice(resellerId: string, productId: string): Promise<void> {
    await this.priceModel
      .deleteOne({
        resellerId: new Types.ObjectId(resellerId),
        productId: new Types.ObjectId(productId),
      })
      .exec();
  }

  listPrices(resellerId: string): Promise<ResellerPriceDocument[]> {
    return this.priceModel
      .find({ resellerId: new Types.ObjectId(resellerId), active: true })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /** Maps productId -> override unit price for the given reseller. */
  async getPriceOverrides(
    resellerId: Types.ObjectId,
    productIds: Types.ObjectId[],
  ): Promise<Map<string, number>> {
    const overrides = await this.priceModel
      .find({ resellerId, productId: { $in: productIds }, active: true })
      .exec();
    return new Map(
      overrides.map((o) => [String(o.productId), o.unitPrice] as const),
    );
  }

  /** Wholesale unit price: explicit override, else retail less tier discount. */
  resolveUnitPrice(
    reseller: ResellerDocument,
    product: ProductDocument,
    override?: number,
  ): number {
    if (override !== undefined) {
      return round2(override);
    }
    return round2(product.pricing.basePrice * (1 - reseller.discountRate));
  }

  // --- API keys ---

  async createApiKey(
    reseller: ResellerDocument,
    dto: CreateApiKeyDto,
  ): Promise<{
    id: string;
    label: string;
    prefix: string;
    key: string;
  }> {
    const raw = `${API_KEY_PREFIX}${randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 12);
    const created = await this.apiKeyModel.create({
      resellerId: reseller._id,
      label: dto.label,
      prefix,
      hash: hashKey(raw),
    });
    return { id: String(created._id), label: created.label, prefix, key: raw };
  }

  listApiKeys(reseller: ResellerDocument): Promise<ResellerApiKeyDocument[]> {
    return this.apiKeyModel
      .find({ resellerId: reseller._id })
      .select('-hash')
      .sort({ createdAt: -1 })
      .exec();
  }

  async revokeApiKey(
    reseller: ResellerDocument,
    keyId: string,
  ): Promise<{ success: boolean }> {
    const result = await this.apiKeyModel
      .updateOne(
        {
          _id: new Types.ObjectId(keyId),
          resellerId: reseller._id,
          revokedAt: { $exists: false },
        },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException('API key not found');
    }
    return { success: true };
  }

  /** Resolves and validates a reseller from a raw API key. */
  async authenticateApiKey(raw: string): Promise<ResellerDocument> {
    const record = await this.apiKeyModel
      .findOne({ hash: hashKey(raw), revokedAt: { $exists: false } })
      .exec();
    if (!record) {
      throw new UnauthorizedException('Invalid API key');
    }
    const reseller = await this.resellerModel
      .findById(record.resellerId)
      .exec();
    if (!reseller || reseller.status !== ResellerStatus.Active) {
      throw new UnauthorizedException('Reseller account is not active');
    }
    await this.apiKeyModel
      .updateOne({ _id: record._id }, { $set: { lastUsedAt: new Date() } })
      .exec();
    return reseller;
  }
}
