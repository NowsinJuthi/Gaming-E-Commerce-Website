import {

  BadRequestException,

  ForbiddenException,

  Injectable,

  NotFoundException,

} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { FilterQuery, Model, Types } from 'mongoose';

import { PaginatedResult } from '../../common/dto/pagination.dto';

import { BlogStatus } from '../../common/enums/blog.enum';

import {
  computeBlogSeoScore,
  MIN_BLOG_SEO_SCORE_TO_SUBMIT,
} from '../../common/utils/blog-seo-score.util';

import { slugify } from '../../common/utils/slugify';

import { Blog, BlogDocument } from '../../database/schemas/blog.schema';

import { UploadsService } from '../../shared/uploads/uploads.service';

import type { AuthenticatedUser } from '../auth/auth.types';

import { BlogCategoryService } from '../blog-category/blog-category.service';

import { RolePermissionsService } from '../role-permissions/role-permissions.service';

import { BLOG_PERMISSION_KEYS } from '../role-permissions/role-permissions.constants';

import { BlogSettingsService } from './blog-settings.service';

import { CreateBlogDto } from './dto/create-blog.dto';

import { QueryBlogDto, QueryPublicBlogDto } from './dto/query-blog.dto';

import { UpdateBlogDto } from './dto/update-blog.dto';



type BlogAuthorLean = {

  _id: Types.ObjectId;

  email: string;

  profile?: {

    displayName?: string;

    firstName?: string;

    lastName?: string;

    avatarUrl?: string;

  };

};



type BlogCategoryLean = {

  _id: Types.ObjectId;

  name: string;

  slug: string;

};



type BlogReviewerLean = {

  _id: Types.ObjectId;

  email: string;

  profile?: {

    displayName?: string;

    firstName?: string;

    lastName?: string;

    avatarUrl?: string;

  };

};



@Injectable()

export class BlogService {

  constructor(

    @InjectModel(Blog.name)

    private readonly blogModel: Model<BlogDocument>,

    private readonly categories: BlogCategoryService,

    private readonly uploads: UploadsService,

    private readonly rolePermissions: RolePermissionsService,

    private readonly blogSettings: BlogSettingsService,

  ) {}



  async create(

    admin: AuthenticatedUser,

    dto: CreateBlogDto,

  ): Promise<Record<string, unknown>> {

    const slug = await this.uniqueSlug(slugify(dto.slug ?? dto.title));

    const categoryFields = await this.categories.resolveCategoryFields(

      dto.categoryId,

      dto.category,

    );

    const canPublish = await this.userCanPublish(admin);

    const status = this.resolveCreateStatus(dto.status, canPublish);

    this.assertBlogSeoScoreMet(
      {
        title: dto.title,
        slug: dto.slug ?? dto.title,
        excerpt: dto.excerpt,
        content: dto.content,
        featuredImage: dto.featuredImage,
        ogImage: dto.ogImage,
        categoryId: dto.categoryId,
        tags: dto.tags,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        focusKeyword: dto.focusKeyword,
        canonicalUrl: dto.canonicalUrl,
      },
      status,
    );

    const submittedAt =

      status === BlogStatus.Pending ? new Date() : undefined;

    const publishedAt =

      status === BlogStatus.Published ? new Date() : undefined;



    const created = await this.blogModel.create({

      title: dto.title.trim(),

      slug,

      excerpt: dto.excerpt?.trim() ?? '',

      content: dto.content,

      featuredImage: dto.featuredImage?.trim(),

      ...categoryFields,

      tags: this.normalizeTags(dto.tags),

      authorId: new Types.ObjectId(admin.id),

      status,

      submittedAt,

      publishedAt,

      metaTitle: dto.metaTitle?.trim(),

      metaDescription: dto.metaDescription?.trim(),

      focusKeyword: dto.focusKeyword?.trim()?.toLowerCase(),

      canonicalUrl: dto.canonicalUrl?.trim(),

      ogImage: dto.ogImage?.trim(),

    });

    const doc = await this.blogModel

      .findById(created._id)

      .populate<{ authorId: BlogAuthorLean }>('authorId', 'email profile')

      .populate<{ categoryId: BlogCategoryLean }>('categoryId', 'name slug')

      .populate<{ reviewedBy: BlogReviewerLean }>('reviewedBy', 'email profile')

      .exec();

    return this.serialize(doc as unknown as BlogDocument, { includeContent: true });

  }



  async listForAdmin(

    query: QueryBlogDto,

    user: AuthenticatedUser,

  ): Promise<PaginatedResult<Record<string, unknown>>> {

    const { page, limit } = query;

    const filter = await this.buildFilter(query);

    if (!(await this.userCanViewAllBlogPosts(user))) {

      filter.authorId = new Types.ObjectId(user.id);

    }

    const [docs, total] = await Promise.all([

      this.blogModel

        .find(filter)

        .sort({ createdAt: -1 })

        .skip((page - 1) * limit)

        .limit(limit)

        .populate('authorId', 'email profile')

        .populate('categoryId', 'name slug')

        .populate('reviewedBy', 'email profile')

        .exec(),

      this.blogModel.countDocuments(filter).exec(),

    ]);

    return {

      items: docs.map((doc) =>

        this.serialize(doc as unknown as BlogDocument, { includeContent: true }),

      ),

      total,

      page,

      limit,

    };

  }



  async getAdminOverview(): Promise<Record<string, unknown>> {

    const now = new Date();

    const startOfDay = new Date(

      now.getFullYear(),

      now.getMonth(),

      now.getDate(),

    );

    const startOfWeek = new Date(startOfDay);

    startOfWeek.setDate(startOfWeek.getDate() - 7);



    const [

      postsTotal,

      published,

      draft,

      pending,

      rejected,

      createdToday,

      createdThisWeek,

      viewsAgg,

      categories,

      recentDocs,

      pendingDocs,

      topCategoryAgg,

    ] = await Promise.all([

      this.blogModel.countDocuments().exec(),

      this.blogModel

        .countDocuments({ status: BlogStatus.Published })

        .exec(),

      this.blogModel.countDocuments({ status: BlogStatus.Draft }).exec(),

      this.blogModel.countDocuments({ status: BlogStatus.Pending }).exec(),

      this.blogModel.countDocuments({ status: BlogStatus.Rejected }).exec(),

      this.blogModel

        .countDocuments({ createdAt: { $gte: startOfDay } })

        .exec(),

      this.blogModel

        .countDocuments({ createdAt: { $gte: startOfWeek } })

        .exec(),

      this.blogModel

        .aggregate<{ total: number }>([

          { $group: { _id: null, total: { $sum: '$views' } } },

        ])

        .exec(),

      this.categories.countStats(),

      this.blogModel

        .find()

        .sort({ createdAt: -1 })

        .limit(6)

        .populate('authorId', 'email profile')

        .populate('categoryId', 'name slug')

        .select('-content')

        .exec(),

      this.blogModel

        .find({ status: BlogStatus.Pending })

        .sort({ submittedAt: -1, createdAt: -1 })

        .limit(5)

        .populate('authorId', 'email profile')

        .populate('categoryId', 'name slug')

        .select('-content')

        .exec(),

      this.blogModel.aggregate<{

        _id: Types.ObjectId;

        count: number;

        name?: string;

        slug?: string;

      }>([

        { $match: { categoryId: { $exists: true, $ne: null } } },

        { $group: { _id: '$categoryId', count: { $sum: 1 } } },

        { $sort: { count: -1 } },

        { $limit: 6 },

        {

          $lookup: {

            from: 'blog_categories',

            localField: '_id',

            foreignField: '_id',

            as: 'category',

          },

        },

        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

        {

          $project: {

            count: 1,

            name: '$category.name',

            slug: '$category.slug',

          },

        },

      ]),

    ]);



    const totalViews = viewsAgg[0]?.total ?? 0;



    return {

      posts: {

        total: postsTotal,

        published,

        draft,

        pending,

        rejected,

        createdToday,

        createdThisWeek,

        totalViews,

      },

      categories,

      recentPosts: recentDocs.map((doc) =>

        this.serialize(doc as unknown as BlogDocument, { includeContent: false }),

      ),

      pendingPosts: pendingDocs.map((doc) =>

        this.serialize(doc as unknown as BlogDocument, { includeContent: false }),

      ),

      topCategories: topCategoryAgg.map((row) => ({

        id: String(row._id),

        name: row.name ?? 'Uncategorized',

        slug: row.slug,

        postCount: row.count,

      })),

    };

  }



  async getForAdmin(

    id: string,

    user: AuthenticatedUser,

  ): Promise<Record<string, unknown>> {

    const doc = await this.blogModel

      .findById(id)

      .populate<{ authorId: BlogAuthorLean }>('authorId', 'email profile')

      .populate<{ categoryId: BlogCategoryLean }>('categoryId', 'name slug')

      .populate<{ reviewedBy: BlogReviewerLean }>('reviewedBy', 'email profile')

      .exec();

    if (!doc) {

      throw new NotFoundException('Blog post not found');

    }

    await this.assertCanAccessBlogPost(user, this.resolveAuthorId(doc.authorId));

    return this.serialize(doc as unknown as BlogDocument, { includeContent: true });

  }



  async update(

    id: string,

    dto: UpdateBlogDto,

    user: AuthenticatedUser,

  ): Promise<Record<string, unknown>> {

    const existing = await this.blogModel.findById(id).exec();

    if (!existing) {

      throw new NotFoundException('Blog post not found');

    }

    await this.assertCanAccessBlogPost(user, this.resolveAuthorId(existing.authorId));

    const canPublish = await this.userCanPublish(user);

    const update: Record<string, unknown> = {};

    if (dto.title !== undefined) update.title = dto.title.trim();

    if (dto.excerpt !== undefined) update.excerpt = dto.excerpt.trim();

    if (dto.content !== undefined) update.content = dto.content;

    if (dto.featuredImage !== undefined) {

      const next = dto.featuredImage.trim() || undefined;

      if (existing.featuredImage && existing.featuredImage !== next) {

        this.uploads.tryDeleteBlogImageByUrl(existing.featuredImage);

      }

      update.featuredImage = next;

    }

    if (dto.ogImage !== undefined) {

      const next = dto.ogImage.trim() || undefined;

      if (existing.ogImage && existing.ogImage !== next) {

        this.uploads.tryDeleteBlogImageByUrl(existing.ogImage);

      }

      update.ogImage = next;

    }

    if (dto.categoryId !== undefined || dto.category !== undefined) {

      const categoryFields = await this.categories.resolveCategoryFields(

        dto.categoryId,

        dto.category,

      );

      Object.assign(update, categoryFields);

      if (dto.categoryId === null || dto.categoryId === '') {

        update.categoryId = undefined;

      }

    }

    if (dto.tags !== undefined) update.tags = this.normalizeTags(dto.tags);

    if (dto.metaTitle !== undefined) {

      update.metaTitle = dto.metaTitle.trim() || undefined;

    }

    if (dto.metaDescription !== undefined) {

      update.metaDescription = dto.metaDescription.trim() || undefined;

    }

    if (dto.focusKeyword !== undefined) {

      update.focusKeyword = dto.focusKeyword.trim().toLowerCase() || undefined;

    }

    if (dto.canonicalUrl !== undefined) {

      update.canonicalUrl = dto.canonicalUrl.trim() || undefined;

    }

    if (dto.slug !== undefined) {

      update.slug = await this.uniqueSlug(slugify(dto.slug), id);

    }

    if (dto.status !== undefined) {

      if (

        dto.status === BlogStatus.Published &&

        !canPublish

      ) {

        throw new ForbiddenException(

          'You do not have permission to publish blog posts.',

        );

      }

      update.status = dto.status;

      if (

        dto.status === BlogStatus.Published &&

        !existing.publishedAt

      ) {

        update.publishedAt = new Date();

      }

      if (dto.status === BlogStatus.Pending) {

        update.submittedAt = new Date();

        update.rejectionReason = undefined;

      }

    }



    if (

      !canPublish &&

      this.shouldRequeueForReview(existing, dto)

    ) {

      update.status = BlogStatus.Pending;

      update.submittedAt = new Date();

      update.rejectionReason = undefined;

    }



    const finalStatus =

      (update.status as BlogStatus | undefined) ?? existing.status;



    this.assertBlogSeoScoreMet(

      {

        title: (dto.title ?? existing.title) as string,

        slug: (dto.slug ?? existing.slug) as string,

        excerpt: (dto.excerpt ?? existing.excerpt) as string,

        content: (dto.content ?? existing.content) as string,

        featuredImage: (dto.featuredImage ?? existing.featuredImage) as

          | string

          | undefined,

        ogImage: (dto.ogImage ?? existing.ogImage) as string | undefined,

        categoryId:

          dto.categoryId !== undefined

            ? dto.categoryId || undefined

            : existing.categoryId

              ? String(existing.categoryId)

              : undefined,

        tags: dto.tags ?? existing.tags,

        metaTitle: (dto.metaTitle ?? existing.metaTitle) as string | undefined,

        metaDescription: (dto.metaDescription ?? existing.metaDescription) as

          | string

          | undefined,

        focusKeyword: (dto.focusKeyword ?? existing.focusKeyword) as

          | string

          | undefined,

        canonicalUrl: (dto.canonicalUrl ?? existing.canonicalUrl) as

          | string

          | undefined,

      },

      finalStatus,

    );



    const doc = await this.blogModel

      .findByIdAndUpdate(id, { $set: update }, { new: true })

      .populate<{ authorId: BlogAuthorLean }>('authorId', 'email profile')

      .populate<{ categoryId: BlogCategoryLean }>('categoryId', 'name slug')

      .populate<{ reviewedBy: BlogReviewerLean }>('reviewedBy', 'email profile')

      .exec();

    if (!doc) {

      throw new NotFoundException('Blog post not found');

    }

    return this.serialize(doc as unknown as BlogDocument, { includeContent: true });

  }



  async approve(

    id: string,

    admin: AuthenticatedUser,

  ): Promise<Record<string, unknown>> {

    const existing = await this.blogModel.findById(id).exec();

    if (!existing) {

      throw new NotFoundException('Blog post not found');

    }

    if (existing.status !== BlogStatus.Pending) {

      throw new BadRequestException('Only pending posts can be approved.');

    }



    this.assertBlogSeoScoreMet(

      {

        title: existing.title,

        slug: existing.slug,

        excerpt: existing.excerpt,

        content: existing.content,

        featuredImage: existing.featuredImage,

        ogImage: existing.ogImage,

        categoryId: existing.categoryId

          ? String(existing.categoryId)

          : undefined,

        tags: existing.tags,

        metaTitle: existing.metaTitle,

        metaDescription: existing.metaDescription,

        focusKeyword: existing.focusKeyword,

        canonicalUrl: existing.canonicalUrl,

      },

      BlogStatus.Published,

    );



    const update: Record<string, unknown> = {

      status: BlogStatus.Published,

      reviewedBy: new Types.ObjectId(admin.id),

      reviewedAt: new Date(),

      rejectionReason: undefined,

    };

    if (!existing.publishedAt) {

      update.publishedAt = new Date();

    }



    const doc = await this.blogModel

      .findByIdAndUpdate(id, { $set: update }, { new: true })

      .populate<{ authorId: BlogAuthorLean }>('authorId', 'email profile')

      .populate<{ categoryId: BlogCategoryLean }>('categoryId', 'name slug')

      .populate<{ reviewedBy: BlogReviewerLean }>('reviewedBy', 'email profile')

      .exec();

    if (!doc) {

      throw new NotFoundException('Blog post not found');

    }

    return this.serialize(doc as unknown as BlogDocument, { includeContent: true });

  }



  async reject(

    id: string,

    admin: AuthenticatedUser,

    rejectionReason?: string,

  ): Promise<Record<string, unknown>> {

    const existing = await this.blogModel.findById(id).exec();

    if (!existing) {

      throw new NotFoundException('Blog post not found');

    }

    if (existing.status !== BlogStatus.Pending) {

      throw new BadRequestException('Only pending posts can be rejected.');

    }



    const doc = await this.blogModel

      .findByIdAndUpdate(

        id,

        {

          $set: {

            status: BlogStatus.Rejected,

            reviewedBy: new Types.ObjectId(admin.id),

            reviewedAt: new Date(),

            rejectionReason: rejectionReason?.trim() || undefined,

          },

        },

        { new: true },

      )

      .populate<{ authorId: BlogAuthorLean }>('authorId', 'email profile')

      .populate<{ categoryId: BlogCategoryLean }>('categoryId', 'name slug')

      .populate<{ reviewedBy: BlogReviewerLean }>('reviewedBy', 'email profile')

      .exec();

    if (!doc) {

      throw new NotFoundException('Blog post not found');

    }

    return this.serialize(doc as unknown as BlogDocument, { includeContent: true });

  }



  async remove(

    id: string,

    user: AuthenticatedUser,

  ): Promise<{ success: boolean }> {

    const existing = await this.blogModel.findById(id).exec();

    if (!existing) {

      throw new NotFoundException('Blog post not found');

    }

    await this.assertCanAccessBlogPost(user, this.resolveAuthorId(existing.authorId));

    await this.blogModel.findByIdAndDelete(id).exec();

    this.uploads.tryDeleteBlogImageByUrl(existing.featuredImage);

    this.uploads.tryDeleteBlogImageByUrl(existing.ogImage);

    return { success: true };

  }



  async listPublished(

    query: QueryPublicBlogDto,

  ): Promise<PaginatedResult<Record<string, unknown>>> {

    const { page, limit } = query;

    const filter: FilterQuery<BlogDocument> = {

      status: BlogStatus.Published,

      ...(await this.buildPublicFilter(query)),

    };

    const [docs, total] = await Promise.all([

      this.blogModel

        .find(filter)

        .select('-content')

        .sort({ publishedAt: -1, createdAt: -1 })

        .skip((page - 1) * limit)

        .limit(limit)

        .populate('authorId', 'email profile')

        .populate('categoryId', 'name slug')

        .exec(),

      this.blogModel.countDocuments(filter).exec(),

    ]);

    return {

      items: docs.map((doc) =>

        this.serialize(doc as unknown as BlogDocument, { includeContent: false }),

      ),

      total,

      page,

      limit,

    };

  }



  async findPublishedBySlug(slug: string): Promise<Record<string, unknown>> {

    const normalized = slug.trim().toLowerCase();
    const features = await this.blogSettings.getPageFeatures();

    const query = this.blogModel
      .findOne({ slug: normalized, status: BlogStatus.Published })
      .populate<{ authorId: BlogAuthorLean }>('authorId', 'email profile')
      .populate<{ categoryId: BlogCategoryLean }>('categoryId', 'name slug');

    const doc = features.viewsEnabled
      ? await this.blogModel
          .findOneAndUpdate(
            { slug: normalized, status: BlogStatus.Published },
            { $inc: { views: 1 } },
            { new: true },
          )
          .populate<{ authorId: BlogAuthorLean }>('authorId', 'email profile')
          .populate<{ categoryId: BlogCategoryLean }>('categoryId', 'name slug')
          .exec()
      : await query.exec();

    if (!doc) {

      throw new NotFoundException('Blog post not found');

    }

    return this.serialize(doc as unknown as BlogDocument, { includeContent: true });

  }



  private async buildFilter(

    query: QueryBlogDto,

  ): Promise<FilterQuery<BlogDocument>> {

    const filter: FilterQuery<BlogDocument> = {};

    if (query.status) filter.status = query.status;

    if (query.categoryId?.trim()) {

      filter.categoryId = new Types.ObjectId(query.categoryId.trim());

    } else if (query.categorySlug?.trim()) {

      const categoryId = await this.categories.findIdBySlug(query.categorySlug);

      if (categoryId) filter.categoryId = categoryId;

      else filter.category = query.categorySlug.trim();

    } else if (query.category?.trim()) {

      filter.category = query.category.trim();

    }

    if (query.tag?.trim()) {

      filter.tags = query.tag.trim().toLowerCase();

    }

    if (query.q?.trim()) {

      filter.$text = { $search: query.q.trim() };

    }

    return filter;

  }



  private async buildPublicFilter(

    query: QueryPublicBlogDto,

  ): Promise<FilterQuery<BlogDocument>> {

    const filter: FilterQuery<BlogDocument> = {};

    if (query.categoryId?.trim()) {

      filter.categoryId = new Types.ObjectId(query.categoryId.trim());

    } else if (query.categorySlug?.trim()) {

      const categoryId = await this.categories.findIdBySlug(query.categorySlug);

      if (categoryId) filter.categoryId = categoryId;

      else filter.category = query.categorySlug.trim();

    } else if (query.category?.trim()) {

      filter.category = query.category.trim();

    }

    if (query.tag?.trim()) {

      filter.tags = query.tag.trim().toLowerCase();

    }

    if (query.q?.trim()) {

      filter.$text = { $search: query.q.trim() };

    }

    return filter;

  }



  private normalizeTags(tags?: string[]): string[] {

    if (!tags?.length) return [];

    return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];

  }



  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {

    const root = base || 'blog-post';

    let candidate = root;

    let suffix = 1;

    while (true) {

      const existing = await this.blogModel

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



  private serialize(

    doc: BlogDocument,

    options: { includeContent: boolean },

  ): Record<string, unknown> {

    const author = doc.populated('authorId')

      ? (doc.authorId as unknown as BlogAuthorLean)

      : null;

    const populatedCategory = doc.populated('categoryId')

      ? (doc.categoryId as unknown as BlogCategoryLean)

      : null;

    const authorName = this.resolveAuthorDisplayName(author);



    const out: Record<string, unknown> = {

      id: String(doc._id),

      title: doc.title,

      slug: doc.slug,

      excerpt: doc.excerpt,

      featuredImage: doc.featuredImage,

      ogImage: doc.ogImage,

      category: populatedCategory?.name ?? doc.category,

      categoryId: populatedCategory

        ? String(populatedCategory._id)

        : doc.categoryId

          ? String(doc.categoryId)

          : undefined,

      categorySlug: populatedCategory?.slug,

      tags: doc.tags ?? [],

      author: author

        ? {

            id: String(author._id),

            email: author.email,

            name: authorName,

            avatarUrl: author.profile?.avatarUrl?.trim() || undefined,

          }

        : { id: String(doc.authorId) },

      status: doc.status,

      views: doc.views ?? 0,

      likeCount: doc.likeCount ?? 0,

      dislikeCount: doc.dislikeCount ?? 0,

      metaTitle: doc.metaTitle,

      metaDescription: doc.metaDescription,

      focusKeyword: doc.focusKeyword,

      canonicalUrl: doc.canonicalUrl,

      publishedAt: doc.publishedAt,

      submittedAt: doc.submittedAt,

      reviewedAt: doc.reviewedAt,

      rejectionReason: doc.rejectionReason,

      reviewedBy: this.serializeReviewer(doc),

      createdAt: (doc as BlogDocument & { createdAt?: Date }).createdAt,

      updatedAt: (doc as BlogDocument & { updatedAt?: Date }).updatedAt,

    };



    if (options.includeContent) {

      out.content = doc.content;

    }



    return out;

  }



  private async userCanPublish(user: AuthenticatedUser): Promise<boolean> {

    return this.rolePermissions.rolesHavePermission(

      user.roles,

      'publish_blog_posts',

    );

  }



  private async userCanViewAllBlogPosts(

    user: AuthenticatedUser,

  ): Promise<boolean> {

    for (const permission of BLOG_PERMISSION_KEYS) {

      if (

        !(await this.rolePermissions.rolesHavePermission(

          user.roles,

          permission,

        ))

      ) {

        return false;

      }

    }

    return true;

  }



  private resolveAuthorDisplayName(author: BlogAuthorLean | null): string | undefined {

    if (!author) return undefined;

    const profile = author.profile;

    const fromProfile =

      profile?.displayName?.trim() ||

      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();

    if (fromProfile) return fromProfile;

    const email = author.email?.trim();

    if (!email) return undefined;

    const at = email.indexOf('@');

    if (at > 0) return email.slice(0, at);

    return email;

  }



  private resolveAuthorId(

    authorId: Types.ObjectId | BlogAuthorLean,

  ): string {

    if (

      authorId &&

      typeof authorId === 'object' &&

      '_id' in authorId &&

      authorId._id

    ) {

      return String(authorId._id);

    }

    return String(authorId);

  }



  private async assertCanAccessBlogPost(

    user: AuthenticatedUser,

    authorId: string,

  ): Promise<void> {

    if (await this.userCanViewAllBlogPosts(user)) return;

    if (authorId === user.id) return;

    throw new ForbiddenException('You can only access your own blog posts');

  }



  private assertBlogSeoScoreMet(

    fields: {

      title: string;

      slug?: string;

      excerpt?: string;

      content: string;

      featuredImage?: string;

      ogImage?: string;

      categoryId?: string;

      tags?: string[];

      metaTitle?: string;

      metaDescription?: string;

      focusKeyword?: string;

      canonicalUrl?: string;

    },

    status: BlogStatus,

  ): void {

    if (status === BlogStatus.Draft) return;



    const { score } = computeBlogSeoScore({

      title: fields.title,

      slug: fields.slug ?? '',

      excerpt: fields.excerpt ?? '',

      content: fields.content,

      featuredImage: fields.featuredImage ?? '',

      ogImage: fields.ogImage ?? '',

      categoryId: fields.categoryId ?? '',

      tagsInput: (fields.tags ?? []).join(', '),

      focusKeyword: fields.focusKeyword ?? '',

      metaTitle: fields.metaTitle ?? '',

      metaDescription: fields.metaDescription ?? '',

      canonicalUrl: fields.canonicalUrl ?? '',

      status,

    });



    if (score < MIN_BLOG_SEO_SCORE_TO_SUBMIT) {

      throw new BadRequestException(

        `SEO score is ${score}/100. Improve SEO to at least ${MIN_BLOG_SEO_SCORE_TO_SUBMIT} before submitting or publishing this post.`,

      );

    }

  }



  private resolveCreateStatus(

    requested: BlogStatus | undefined,

    canPublish: boolean,

  ): BlogStatus {

    if (canPublish) {

      return requested ?? BlogStatus.Draft;

    }

    if (

      requested === BlogStatus.Published ||

      requested === BlogStatus.Pending

    ) {

      return BlogStatus.Pending;

    }

    return BlogStatus.Draft;

  }



  private shouldRequeueForReview(

    existing: BlogDocument,

    dto: UpdateBlogDto,

  ): boolean {

    if (existing.status === BlogStatus.Published && this.hasContentChanges(existing, dto)) {

      return true;

    }

    if (existing.status === BlogStatus.Rejected) {

      return (

        this.hasContentChanges(existing, dto) ||

        dto.status === BlogStatus.Pending

      );

    }

    return false;

  }



  private hasContentChanges(

    existing: BlogDocument,

    dto: UpdateBlogDto,

  ): boolean {

    if (dto.title !== undefined && dto.title.trim() !== existing.title) {

      return true;

    }

    if (dto.excerpt !== undefined && dto.excerpt.trim() !== existing.excerpt) {

      return true;

    }

    if (dto.content !== undefined && dto.content !== existing.content) {

      return true;

    }

    if (dto.featuredImage !== undefined) {

      const next = dto.featuredImage.trim() || undefined;

      if (next !== (existing.featuredImage || undefined)) return true;

    }

    if (dto.ogImage !== undefined) {

      const next = dto.ogImage.trim() || undefined;

      if (next !== (existing.ogImage || undefined)) return true;

    }

    if (dto.tags !== undefined) {

      const next = this.normalizeTags(dto.tags).join(',');

      const prev = this.normalizeTags(existing.tags).join(',');

      if (next !== prev) return true;

    }

    if (dto.metaTitle !== undefined) {

      const next = dto.metaTitle.trim() || undefined;

      if (next !== (existing.metaTitle || undefined)) return true;

    }

    if (dto.metaDescription !== undefined) {

      const next = dto.metaDescription.trim() || undefined;

      if (next !== (existing.metaDescription || undefined)) return true;

    }

    if (dto.focusKeyword !== undefined) {

      const next = dto.focusKeyword.trim().toLowerCase() || undefined;

      if (next !== (existing.focusKeyword || undefined)) return true;

    }

    if (dto.canonicalUrl !== undefined) {

      const next = dto.canonicalUrl.trim() || undefined;

      if (next !== (existing.canonicalUrl || undefined)) return true;

    }

    if (dto.categoryId !== undefined || dto.category !== undefined) {

      return true;

    }

    if (dto.slug !== undefined) {

      return true;

    }

    return false;

  }



  private serializeReviewer(

    doc: BlogDocument,

  ): Record<string, unknown> | undefined {

    if (!doc.reviewedBy) return undefined;

    if (!doc.populated('reviewedBy')) {

      return { id: String(doc.reviewedBy) };

    }

    const reviewer = doc.reviewedBy as unknown as BlogReviewerLean;

    const profile = reviewer.profile;

    const name =

      profile?.displayName?.trim() ||

      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||

      reviewer.email;

    return {

      id: String(reviewer._id),

      email: reviewer.email,

      name,

    };

  }

}


