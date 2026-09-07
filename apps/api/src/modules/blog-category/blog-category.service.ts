import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { slugify } from '../../common/utils/slugify';
import { Blog, BlogDocument } from '../../database/schemas/blog.schema';
import {
  BlogCategory,
  BlogCategoryDocument,
} from '../../database/schemas/blog-category.schema';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';

@Injectable()
export class BlogCategoryService {
  constructor(
    @InjectModel(BlogCategory.name)
    private readonly categoryModel: Model<BlogCategoryDocument>,
    @InjectModel(Blog.name)
    private readonly blogModel: Model<BlogDocument>,
  ) {}

  async create(dto: CreateBlogCategoryDto): Promise<Record<string, unknown>> {
    const slug = await this.uniqueSlug(slugify(dto.slug ?? dto.name));
    const created = await this.categoryModel.create({
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() ?? '',
      isActive: dto.isActive ?? true,
      seo: dto.seo,
    });
    return this.serialize(created);
  }

  async update(
    id: string,
    dto: UpdateBlogCategoryDto,
  ): Promise<Record<string, unknown>> {
    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.description !== undefined) {
      update.description = dto.description.trim();
    }
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.seo !== undefined) update.seo = dto.seo;
    if (dto.slug !== undefined) {
      update.slug = await this.uniqueSlug(slugify(dto.slug), id);
    }

    const doc = await this.categoryModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .exec();
    if (!doc) {
      throw new NotFoundException('Blog category not found');
    }
    return this.serialize(doc);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const objectId = new Types.ObjectId(id);
    const postCount = await this.blogModel
      .countDocuments({ categoryId: objectId })
      .exec();
    if (postCount > 0) {
      throw new BadRequestException(
        `Cannot delete category: ${postCount} blog post${postCount === 1 ? '' : 's'} still use it. Reassign or delete those posts first.`,
      );
    }

    const result = await this.categoryModel.findByIdAndDelete(objectId).exec();
    if (!result) {
      throw new NotFoundException('Blog category not found');
    }
    return { success: true };
  }

  listPublic(): Promise<Record<string, unknown>[]> {
    return this.categoryModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec()
      .then((docs) => docs.map((doc) => this.serialize(doc)));
  }

  listAdmin(): Promise<Record<string, unknown>[]> {
    return this.categoryModel
      .find()
      .sort({ name: 1 })
      .exec()
      .then((docs) => docs.map((doc) => this.serialize(doc)));
  }

  async findBySlug(slug: string): Promise<Record<string, unknown>> {
    const doc = await this.categoryModel
      .findOne({ slug: slug.trim().toLowerCase(), isActive: true })
      .exec();
    if (!doc) {
      throw new NotFoundException('Blog category not found');
    }
    return this.serialize(doc);
  }

  async getForAdmin(id: string): Promise<Record<string, unknown>> {
    const doc = await this.categoryModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('Blog category not found');
    }
    return this.serialize(doc);
  }

  async resolveCategoryFields(
    categoryId?: string,
    categoryName?: string,
  ): Promise<{ categoryId?: Types.ObjectId; category?: string }> {
    if (categoryId?.trim()) {
      const doc = await this.categoryModel.findById(categoryId.trim()).exec();
      if (!doc) {
        throw new BadRequestException('Blog category not found');
      }
      return {
        categoryId: doc._id as Types.ObjectId,
        category: doc.name,
      };
    }
    if (categoryName?.trim()) {
      return { category: categoryName.trim() };
    }
    return {};
  }

  async findIdBySlug(slug: string): Promise<Types.ObjectId | null> {
    const doc = await this.categoryModel
      .findOne({ slug: slug.trim().toLowerCase() })
      .select('_id')
      .lean()
      .exec();
    return doc ? (doc._id as Types.ObjectId) : null;
  }

  async countStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const [total, active] = await Promise.all([
      this.categoryModel.countDocuments().exec(),
      this.categoryModel.countDocuments({ isActive: true }).exec(),
    ]);
    return { total, active, inactive: Math.max(0, total - active) };
  }

  private serialize(doc: BlogCategoryDocument): Record<string, unknown> {
    return {
      id: String(doc._id),
      name: doc.name,
      slug: doc.slug,
      description: doc.description ?? '',
      isActive: doc.isActive ?? true,
      seo: doc.seo ?? {},
      createdAt: (doc as BlogCategoryDocument & { createdAt?: Date }).createdAt,
      updatedAt: (doc as BlogCategoryDocument & { updatedAt?: Date }).updatedAt,
    };
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = base || 'category';
    let candidate = root;
    let suffix = 1;
    while (true) {
      const existing = await this.categoryModel
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
