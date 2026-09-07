import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { OrderStatus, ProductStatus } from '../../common/enums';
import { isChatStaff } from '../../common/utils/role.utils';
import { ReviewStatus } from '../../common/enums/review.enum';
import { escapeRegex } from '../../common/utils/escape-regex';
import { Category, CategoryDocument } from '../../database/schemas/category.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { Product, ProductDocument } from '../../database/schemas/product.schema';
import {
  ProductReview,
  ProductReviewDocument,
} from '../../database/schemas/product-review.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(ProductReview.name)
    private readonly reviewModel: Model<ProductReviewDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateReviewDto) {
    if (!Types.ObjectId.isValid(dto.productId)) {
      throw new BadRequestException('Invalid product');
    }

    const product = await this.productModel
      .findById(dto.productId)
      .select('title slug')
      .lean()
      .exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const productObjectId = new Types.ObjectId(dto.productId);
    const userObjectId = new Types.ObjectId(user.id);

    const existing = await this.reviewModel
      .findOne({ productId: productObjectId, userId: userObjectId })
      .select('_id status')
      .lean()
      .exec();
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    const isStaff = isChatStaff(user.roles);
    let orderId: Types.ObjectId | undefined;

    if (!isStaff) {
      const deliveredOrder = await this.orderModel
        .findOne({
          userId: userObjectId,
          status: OrderStatus.Delivered,
          'items.productId': productObjectId,
        })
        .select('_id')
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      if (!deliveredOrder) {
        throw new ForbiddenException(
          'You can review this product after your order is delivered',
        );
      }
      orderId = deliveredOrder._id;
    }

    const dbUser = await this.userModel
      .findById(user.id)
      .select('email profile')
      .lean()
      .exec();
    const customerName =
      dbUser?.profile?.displayName?.trim() ||
      [dbUser?.profile?.firstName, dbUser?.profile?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      user.email.split('@')[0] ||
      'Customer';

    const created = await this.reviewModel.create({
      productId: productObjectId,
      productTitle: product.title,
      productSlug: product.slug,
      userId: userObjectId,
      customerName,
      customerEmail: user.email,
      rating: dto.rating,
      title: dto.title?.trim() || undefined,
      body: dto.body.trim(),
      status: ReviewStatus.Pending,
      orderId,
    });

    const createdLean = created.toObject();
    return this.toSubmitView(createdLean as unknown as Record<string, unknown>);
  }

  async getEligibility(user: AuthenticatedUser, productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      return { canReview: false, reason: 'invalid_product' as const };
    }

    const productObjectId = new Types.ObjectId(productId);
    const userObjectId = new Types.ObjectId(user.id);

    const existing = await this.reviewModel
      .findOne({ productId: productObjectId, userId: userObjectId })
      .select('_id status')
      .lean()
      .exec();
    if (existing) {
      if (existing.status === ReviewStatus.Pending) {
        return {
          canReview: false,
          reason: 'pending_approval' as const,
          reviewId: String(existing._id),
          status: existing.status,
        };
      }
      return {
        canReview: false,
        reason: 'already_reviewed' as const,
        reviewId: String(existing._id),
        status: existing.status,
      };
    }

    const isStaff = isChatStaff(user.roles);
    if (isStaff) {
      return { canReview: true, reason: 'staff' as const };
    }

    const deliveredOrder = await this.orderModel
      .findOne({
        userId: userObjectId,
        status: OrderStatus.Delivered,
        'items.productId': productObjectId,
      })
      .select('_id')
      .lean()
      .exec();

    if (!deliveredOrder) {
      return {
        canReview: false,
        reason: 'not_delivered' as const,
      };
    }

    return {
      canReview: true,
      reason: 'delivered' as const,
      orderId: String(deliveredOrder._id),
    };
  }

  async adminList(query: QueryReviewDto) {
    const filter: FilterQuery<ProductReviewDocument> = {};
    const q = query.search?.trim();

    if (query.status) {
      filter.status = query.status;
    }
    if (query.rating) {
      filter.rating = query.rating;
    }
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { customerName: regex },
        { customerEmail: regex },
        { productTitle: regex },
        { title: regex },
        { body: regex },
      ];
    }

    const items = await this.reviewModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      items: items.map((item) => this.toAdminView(item as Record<string, unknown>)),
    };
  }

  async getPublicFilters() {
    const [productCounts, categories, products] = await Promise.all([
      this.reviewModel
        .aggregate<{ _id: Types.ObjectId; count: number }>([
          { $match: { status: ReviewStatus.Published } },
          { $group: { _id: '$productId', count: { $sum: 1 } } },
        ])
        .exec(),
      this.categoryModel
        .find({ isActive: true })
        .select('name slug order')
        .sort({ order: 1, name: 1 })
        .lean()
        .exec(),
      this.productModel
        .find({
          status: { $in: [ProductStatus.Active, ProductStatus.OutOfStock] },
        })
        .select('title slug categoryId categoryIds')
        .sort({ title: 1 })
        .lean()
        .exec(),
    ]);

    const countByProduct = new Map(
      productCounts.map((row) => [String(row._id), row.count]),
    );

    const categoryItems = categories.map((category) => {
      const categoryId = String(category._id);
      let reviewCount = 0;
      for (const product of products) {
        if (this.productBelongsToCategory(product, categoryId)) {
          reviewCount += countByProduct.get(String(product._id)) ?? 0;
        }
      }
      return {
        id: categoryId,
        name: category.name,
        slug: category.slug,
        reviewCount,
      };
    });

    const productItems = products.map((product) => ({
      id: String(product._id),
      title: product.title,
      slug: product.slug,
      categoryId: String(product.categoryId),
      reviewCount: countByProduct.get(String(product._id)) ?? 0,
    }));

    return {
      categories: categoryItems,
      products: productItems,
    };
  }

  async listPublished(
    page: number,
    limit: number,
    search?: string,
    productId?: string,
    categoryId?: string,
  ) {
    const filter: FilterQuery<ProductReviewDocument> = {
      status: ReviewStatus.Published,
    };
    const skip = (page - 1) * limit;

    if (productId) {
      if (!Types.ObjectId.isValid(productId)) {
        return { items: [], total: 0, page, limit };
      }
      filter.productId = new Types.ObjectId(productId);
    } else if (categoryId) {
      const productIds = await this.productIdsForCategory(categoryId);
      if (!productIds.length) {
        return { items: [], total: 0, page, limit };
      }
      filter.productId = { $in: productIds };
    }

    if (search) {
      const term = escapeRegex(search);
      const regex = { $regex: term, $options: 'i' };

      const [categories, productsByTitle] = await Promise.all([
        this.categoryModel.find({ name: regex }).select('_id').lean().exec(),
        this.productModel
          .find({
            title: regex,
            status: { $in: [ProductStatus.Active, ProductStatus.OutOfStock] },
          })
          .select('_id')
          .lean()
          .exec(),
      ]);

      const categoryIds = categories.map((category) => category._id);
      const productIdsFromCategory = categoryIds.length
        ? (
            await this.productModel
              .find({
                status: { $in: [ProductStatus.Active, ProductStatus.OutOfStock] },
                $or: [
                  { categoryId: { $in: categoryIds } },
                  { categoryIds: { $in: categoryIds } },
                  { categoryPath: { $in: categoryIds } },
                ],
              })
              .select('_id')
              .lean()
              .exec()
          ).map((product) => product._id)
        : [];

      const matchedProductIds = [
        ...new Set([
          ...productsByTitle.map((product) => product._id),
          ...productIdsFromCategory,
        ]),
      ];

      const searchClauses: FilterQuery<ProductReviewDocument>[] = [
        { productTitle: regex },
      ];
      if (matchedProductIds.length) {
        searchClauses.push({ productId: { $in: matchedProductIds } });
      }

      filter.$or = searchClauses;
    }

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);

    const productIds = [
      ...new Set(
        items
          .map((item) => item.productId)
          .filter((id) => Types.ObjectId.isValid(String(id))),
      ),
    ];

    const products = productIds.length
      ? await this.productModel
          .find({ _id: { $in: productIds } })
          .select('title slug categoryId')
          .populate('categoryId', 'name slug')
          .lean()
          .exec()
      : [];

    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );

    return {
      items: items.map((item) =>
        this.toPublicListView(
          item as Record<string, unknown>,
          productMap.get(String(item.productId)),
        ),
      ),
      total,
      page,
      limit,
    };
  }

  async listPublishedByProduct(
    productId: string,
    page = 1,
    limit = 10,
  ) {
    const emptySummary = {
      avg: 0,
      count: 0,
      distribution: [0, 0, 0, 0, 0],
    };

    if (!Types.ObjectId.isValid(productId)) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        summary: emptySummary,
      };
    }

    const productObjectId = new Types.ObjectId(productId);
    const filter = {
      productId: productObjectId,
      status: ReviewStatus.Published,
    };
    const skip = (page - 1) * limit;

    const [items, total, ratingGroups] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
      this.reviewModel
        .aggregate<{ _id: number; count: number; sum: number }>([
          { $match: filter },
          {
            $group: {
              _id: '$rating',
              count: { $sum: 1 },
              sum: { $sum: '$rating' },
            },
          },
        ])
        .exec(),
    ]);

    const distribution = [0, 0, 0, 0, 0];
    let ratingSum = 0;
    for (const group of ratingGroups) {
      const star = Math.round(Number(group._id));
      if (star >= 1 && star <= 5) {
        distribution[star - 1] = group.count;
        ratingSum += group.sum;
      }
    }

    const avg = total > 0 ? ratingSum / total : 0;

    return {
      items: items.map((item) =>
        this.toPublicView(item as Record<string, unknown>),
      ),
      total,
      page,
      limit,
      summary: {
        avg: Math.round(avg * 10) / 10,
        count: total,
        distribution,
      },
    };
  }

  async update(id: string, dto: UpdateReviewDto) {
    const before = await this.reviewModel
      .findById(id)
      .select('productId status rating')
      .lean()
      .exec();
    if (!before) {
      throw new NotFoundException('Review not found');
    }

    const update: Record<string, unknown> = {};
    if (dto.customerName !== undefined) {
      update.customerName = dto.customerName.trim();
    }
    if (dto.customerEmail !== undefined) {
      update.customerEmail = dto.customerEmail.trim().toLowerCase() || undefined;
    }
    if (dto.rating !== undefined) update.rating = dto.rating;
    if (dto.title !== undefined) update.title = dto.title.trim() || undefined;
    if (dto.body !== undefined) update.body = dto.body.trim();
    if (dto.status !== undefined) update.status = dto.status;
    if (dto.adminReply !== undefined) {
      update.adminReply = dto.adminReply.trim() || undefined;
    }
    if (dto.createdAt !== undefined) {
      const createdAt = new Date(dto.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        throw new BadRequestException('Invalid submitted date');
      }
      update.createdAt = createdAt;
    }

    const review = await this.reviewModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .lean()
      .exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const statusChanged =
      dto.status !== undefined && dto.status !== before.status;
    const ratingChanged =
      dto.rating !== undefined && dto.rating !== before.rating;
    const affectsPublishedRatings =
      before.status === ReviewStatus.Published ||
      review.status === ReviewStatus.Published;

    if (statusChanged || (ratingChanged && affectsPublishedRatings)) {
      await this.syncProductRatings(before.productId);
    }

    return this.toAdminView(review as Record<string, unknown>);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.reviewModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Review not found');
    }
    await this.syncProductRatings(result.productId);
    return { success: true };
  }

  private async syncProductRatings(productId: Types.ObjectId) {
    const published = await this.reviewModel
      .find({ productId, status: ReviewStatus.Published })
      .select('rating')
      .lean()
      .exec();

    const count = published.length;
    const avg =
      count > 0
        ? published.reduce((sum, item) => sum + item.rating, 0) / count
        : 0;

    await this.productModel.updateOne(
      { _id: productId },
      {
        $set: {
          ratings: {
            avg: Math.round(avg * 10) / 10,
            count,
          },
        },
      },
    );
  }

  private productBelongsToCategory(
    product: {
      categoryId?: Types.ObjectId;
      categoryIds?: Types.ObjectId[];
    },
    categoryId: string,
  ): boolean {
    if (String(product.categoryId) === categoryId) return true;
    return (product.categoryIds ?? []).some((id) => String(id) === categoryId);
  }

  private async productIdsForCategory(
    categoryId: string,
  ): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(categoryId)) return [];
    const categoryObjectId = new Types.ObjectId(categoryId);
    const products = await this.productModel
      .find({
        status: { $in: [ProductStatus.Active, ProductStatus.OutOfStock] },
        $or: [
          { categoryId: categoryObjectId },
          { categoryIds: categoryObjectId },
          { categoryPath: categoryObjectId },
        ],
      })
      .select('_id')
      .lean()
      .exec();
    return products.map((product) => product._id);
  }

  private toSubmitView(item: Record<string, unknown>) {
    return {
      ...this.toPublicView(item),
      status: item.status,
    };
  }

  private toPublicListView(
    item: Record<string, unknown>,
    product?: {
      title?: string;
      slug?: string;
      categoryId?:
        | Types.ObjectId
        | { name?: string; slug?: string }
        | null;
    } | null,
  ) {
    const category =
      product?.categoryId &&
      typeof product.categoryId === 'object' &&
      'name' in product.categoryId
        ? product.categoryId
        : null;

    return {
      ...this.toPublicView(item),
      productId: String(item.productId),
      productTitle: String(item.productTitle ?? product?.title ?? ''),
      productSlug: item.productSlug
        ? String(item.productSlug)
        : product?.slug,
      categoryName: category?.name ? String(category.name) : undefined,
      categorySlug: category?.slug ? String(category.slug) : undefined,
    };
  }

  private toPublicView(item: Record<string, unknown>) {
    return {
      _id: String(item._id),
      customerName: String(item.customerName ?? 'Customer'),
      rating: Number(item.rating ?? 0),
      title: item.title ? String(item.title) : undefined,
      body: String(item.body ?? ''),
      adminReply: item.adminReply ? String(item.adminReply) : undefined,
      adminReplyAuthor: item.adminReplyAuthor
        ? String(item.adminReplyAuthor)
        : undefined,
      adminReplyAt:
        item.adminReplyAt instanceof Date
          ? item.adminReplyAt.toISOString()
          : undefined,
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : String(item.createdAt ?? ''),
    };
  }

  private toAdminView(item: Record<string, unknown>) {
    return {
      _id: String(item._id),
      productId: String(item.productId),
      productTitle: String(item.productTitle ?? ''),
      productSlug: item.productSlug ? String(item.productSlug) : undefined,
      customerName: String(item.customerName ?? ''),
      customerEmail: item.customerEmail
        ? String(item.customerEmail)
        : undefined,
      rating: Number(item.rating ?? 0),
      title: item.title ? String(item.title) : undefined,
      body: String(item.body ?? ''),
      status: item.status,
      adminReply: item.adminReply ? String(item.adminReply) : undefined,
      adminReplyAuthor: item.adminReplyAuthor
        ? String(item.adminReplyAuthor)
        : undefined,
      adminReplyAt:
        item.adminReplyAt instanceof Date
          ? item.adminReplyAt.toISOString()
          : undefined,
      orderId: item.orderId ? String(item.orderId) : undefined,
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : String(item.createdAt ?? ''),
      updatedAt:
        item.updatedAt instanceof Date
          ? item.updatedAt.toISOString()
          : String(item.updatedAt ?? ''),
    };
  }
}
