import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReviewStatus } from '../../common/enums/review.enum';
import { BlogStatus } from '../../common/enums/blog.enum';
import { Blog, BlogDocument } from '../../database/schemas/blog.schema';
import {
  BlogReaction,
  BlogReactionDocument,
  BlogReactionType,
} from '../../database/schemas/blog-reaction.schema';
import {
  BlogReview,
  BlogReviewDocument,
} from '../../database/schemas/blog-review.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateBlogReviewDto } from './dto/create-blog-review.dto';
import { BlogSettingsService } from './blog-settings.service';

@Injectable()
export class BlogEngagementService {
  constructor(
    @InjectModel(Blog.name)
    private readonly blogModel: Model<BlogDocument>,
    @InjectModel(BlogReview.name)
    private readonly reviewModel: Model<BlogReviewDocument>,
    @InjectModel(BlogReaction.name)
    private readonly reactionModel: Model<BlogReactionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly blogSettings: BlogSettingsService,
  ) {}

  async listPublishedReviews(slug: string, page = 1, limit = 10) {
    const emptySummary = {
      avg: 0,
      count: 0,
      distribution: [0, 0, 0, 0, 0],
    };

    const features = await this.blogSettings.getPageFeatures();
    if (!features.reviewsEnabled) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        summary: emptySummary,
      };
    }

    const blog = await this.findPublishedBlogLean(slug);
    if (!blog) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        summary: emptySummary,
      };
    }

    const blogId = blog._id;
    const filter = {
      blogId,
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
      const rating = Number(group._id);
      if (rating >= 1 && rating <= 5) {
        distribution[rating - 1] = group.count;
        ratingSum += group.sum;
      }
    }
    const avg = total > 0 ? ratingSum / total : 0;

    return {
      items: items.map((item) =>
        this.toPublicReviewView(item as Record<string, unknown>),
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

  async getReviewEligibility(user: AuthenticatedUser, slug: string) {
    const features = await this.blogSettings.getPageFeatures();
    if (!features.reviewsEnabled) {
      return {
        canReview: false,
        reason: 'disabled' as const,
      };
    }

    const blog = await this.findPublishedBlogLean(slug);
    if (!blog) {
      return {
        canReview: false,
        reason: 'invalid_post' as const,
      };
    }

    const existing = await this.reviewModel
      .findOne({
        blogId: blog._id,
        userId: new Types.ObjectId(user.id),
      })
      .select('_id status')
      .lean()
      .exec();

    if (existing) {
      return {
        canReview: false,
        reason: 'already_reviewed' as const,
        reviewId: String(existing._id),
        status: existing.status,
      };
    }

    return {
      canReview: true,
      reason: 'eligible' as const,
    };
  }

  async createReview(
    user: AuthenticatedUser,
    slug: string,
    dto: CreateBlogReviewDto,
  ) {
    const features = await this.blogSettings.getPageFeatures();
    if (!features.reviewsEnabled) {
      throw new BadRequestException('Article reviews are disabled');
    }

    const blog = await this.findPublishedBlogLean(slug);
    if (!blog) {
      throw new NotFoundException('Blog post not found');
    }

    const blogObjectId = blog._id;
    const userObjectId = new Types.ObjectId(user.id);

    const existing = await this.reviewModel
      .findOne({ blogId: blogObjectId, userId: userObjectId })
      .select('_id')
      .lean()
      .exec();
    if (existing) {
      throw new ConflictException('You have already reviewed this article');
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
      'Reader';

    const created = await this.reviewModel.create({
      blogId: blogObjectId,
      blogTitle: blog.title,
      blogSlug: blog.slug,
      userId: userObjectId,
      customerName,
      customerEmail: user.email,
      rating: dto.rating,
      title: dto.title?.trim() || undefined,
      body: dto.body.trim(),
      status: ReviewStatus.Published,
    });

    const createdLean = created.toObject();
    return {
      ...this.toPublicReviewView(createdLean as unknown as Record<string, unknown>),
      status: created.status,
    };
  }

  async getReactions(slug: string) {
    const features = await this.blogSettings.getPageFeatures();
    if (!features.reactionsEnabled) {
      return { likeCount: 0, dislikeCount: 0 };
    }

    const blog = await this.findPublishedBlogLean(slug);
    if (!blog) {
      return { likeCount: 0, dislikeCount: 0 };
    }

    return {
      likeCount: blog.likeCount ?? 0,
      dislikeCount: blog.dislikeCount ?? 0,
    };
  }

  async getUserReaction(user: AuthenticatedUser, slug: string) {
    const features = await this.blogSettings.getPageFeatures();
    if (!features.reactionsEnabled) {
      return { reaction: null as BlogReactionType | null };
    }

    const blog = await this.findPublishedBlogLean(slug);
    if (!blog) {
      return { reaction: null as BlogReactionType | null };
    }

    const existing = await this.reactionModel
      .findOne({
        blogId: blog._id,
        userId: new Types.ObjectId(user.id),
      })
      .select('type')
      .lean()
      .exec();

    return {
      reaction: (existing?.type as BlogReactionType | undefined) ?? null,
    };
  }

  async setReaction(
    user: AuthenticatedUser,
    slug: string,
    type: BlogReactionType,
  ) {
    const features = await this.blogSettings.getPageFeatures();
    if (!features.reactionsEnabled) {
      throw new BadRequestException('Article reactions are disabled');
    }

    const blog = await this.findPublishedBlogLean(slug);
    if (!blog) {
      throw new NotFoundException('Blog post not found');
    }

    const blogId = blog._id;
    const userId = new Types.ObjectId(user.id);
    const existing = await this.reactionModel
      .findOne({ blogId, userId })
      .exec();

    if (!existing) {
      await this.reactionModel.create({ blogId, userId, type });
      await this.adjustReactionCounts(blogId, type, 1);
      return this.buildReactionState(blogId, userId);
    }

    if (existing.type === type) {
      await this.reactionModel.deleteOne({ _id: existing._id }).exec();
      await this.adjustReactionCounts(blogId, type, -1);
      return this.buildReactionState(blogId, userId);
    }

    const previousType = existing.type;
    existing.type = type;
    await existing.save();
    await this.adjustReactionCounts(blogId, previousType, -1);
    await this.adjustReactionCounts(blogId, type, 1);
    return this.buildReactionState(blogId, userId);
  }

  private async buildReactionState(blogId: Types.ObjectId, userId: Types.ObjectId) {
    const [blog, reaction] = await Promise.all([
      this.blogModel
        .findById(blogId)
        .select('likeCount dislikeCount')
        .lean()
        .exec(),
      this.reactionModel
        .findOne({ blogId, userId })
        .select('type')
        .lean()
        .exec(),
    ]);

    return {
      likeCount: blog?.likeCount ?? 0,
      dislikeCount: blog?.dislikeCount ?? 0,
      reaction: (reaction?.type as BlogReactionType | undefined) ?? null,
    };
  }

  private async adjustReactionCounts(
    blogId: Types.ObjectId,
    type: BlogReactionType,
    delta: 1 | -1,
  ) {
    const field = type === 'like' ? 'likeCount' : 'dislikeCount';
    if (delta === -1) {
      await this.blogModel
        .updateOne({ _id: blogId, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } })
        .exec();
      return;
    }
    await this.blogModel.updateOne({ _id: blogId }, { $inc: { [field]: 1 } }).exec();
  }

  private async findPublishedBlogLean(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Invalid article slug');
    }

    return this.blogModel
      .findOne({ slug: normalized, status: BlogStatus.Published })
      .select('_id title slug likeCount dislikeCount')
      .lean()
      .exec();
  }

  private toPublicReviewView(item: Record<string, unknown>) {
    return {
      id: String(item._id),
      customerName: String(item.customerName ?? 'Reader'),
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
}
