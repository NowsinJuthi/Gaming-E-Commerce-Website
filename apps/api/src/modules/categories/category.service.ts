import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { slugify } from '../../common/utils/slugify';
import {
  Category,
  CategoryDocument,
} from '../../database/schemas/category.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import { EventsService } from '../../shared/events/events.service';
import { AppEvent } from '../../shared/events/events.types';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

export interface CategoryTreeNode {
  _id: string;
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  depth: number;
  order: number;
  isActive: boolean;
  productCount?: number;
  seo?: Category['seo'];
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly events: EventsService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    const slug = await this.uniqueSlug(slugify(dto.slug ?? dto.name));

    let path: Types.ObjectId[] = [];
    let depth = 0;
    if (dto.parentId) {
      const parent = await this.categoryModel.findById(dto.parentId).exec();
      if (!parent) {
        throw new BadRequestException('Parent category not found');
      }
      path = [...parent.path, parent._id];
      depth = parent.depth + 1;
    }

    const created = await this.categoryModel.create({
      name: dto.name,
      slug,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
      path,
      depth,
      isActive: dto.isActive ?? true,
      order: dto.order ?? 0,
      seo: dto.seo,
    });
    this.events.emit(AppEvent.CategoryCreated, {
      id: String(created._id),
      slug: created.slug,
      name: created.name,
    });
    return created;
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.order !== undefined) update.order = dto.order;
    if (dto.seo !== undefined) update.seo = dto.seo;
    if (dto.slug !== undefined) {
      update.slug = await this.uniqueSlug(slugify(dto.slug), id);
    }

    const category = await this.categoryModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    this.events.emit(AppEvent.CategoryUpdated, {
      id: String(category._id),
      slug: category.slug,
      name: category.name,
    });
    return category;
  }

  async remove(
    id: string,
    reassignToCategoryId?: string,
  ): Promise<{ success: boolean; reassignedProducts?: number }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Category not found');
    }
    const categoryId = new Types.ObjectId(id);

    const childCount = await this.categoryModel
      .countDocuments({ parentId: categoryId })
      .exec();
    if (childCount > 0) {
      throw new ConflictException(
        'Cannot delete a category that has subcategories. Remove or move them first.',
      );
    }

    const productCount = await this.productModel
      .countDocuments({
        $or: [{ categoryId }, { categoryIds: categoryId }],
      })
      .exec();

    let reassignedProducts = 0;
    if (productCount > 0) {
      if (!reassignToCategoryId) {
        throw new ConflictException(
          'This category has products. Choose another category to move them to before deleting.',
        );
      }
      if (!Types.ObjectId.isValid(reassignToCategoryId)) {
        throw new BadRequestException('Invalid reassignment category');
      }
      if (reassignToCategoryId === id) {
        throw new BadRequestException(
          'Choose a different category to move products into',
        );
      }
      reassignedProducts = await this.reassignProducts(
        id,
        reassignToCategoryId,
      );
    }

    const result = await this.categoryModel.findByIdAndDelete(categoryId).exec();
    if (!result) {
      throw new NotFoundException('Category not found');
    }
    this.events.emit(AppEvent.CategoryDeleted, { id });
    return { success: true, reassignedProducts };
  }

  private async reassignProducts(
    fromCategoryId: string,
    toCategoryId: string,
  ): Promise<number> {
    const target = await this.categoryModel.findById(toCategoryId).exec();
    if (!target) {
      throw new BadRequestException('Reassignment category not found');
    }

    const fromObjectId = new Types.ObjectId(fromCategoryId);
    const products = await this.productModel
      .find({
        $or: [{ categoryId: fromObjectId }, { categoryIds: fromObjectId }],
      })
      .select({ categoryId: 1, categoryIds: 1 })
      .lean()
      .exec();

    let modified = 0;
    for (const product of products) {
      const existing = (
        product.categoryIds?.length
          ? product.categoryIds
          : product.categoryId
            ? [product.categoryId]
            : []
      ).map((id) => String(id));

      const next = existing.filter((id) => id !== fromCategoryId);
      if (!next.includes(toCategoryId)) {
        next.push(toCategoryId);
      }

      const resolved = await this.resolveProductCategories(next);
      await this.productModel
        .updateOne({ _id: product._id }, { $set: resolved })
        .exec();
      modified += 1;
    }

    return modified;
  }

  async findBySlug(slug: string): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne({ slug: slug.toLowerCase() })
      .exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  /** Returns the materialized path for a product (ancestors + self). */
  async buildProductPath(categoryId: string): Promise<Types.ObjectId[]> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    return [...category.path, category._id];
  }

  /** Resolve primary category, all assigned ids, and merged ancestor paths. */
  async resolveProductCategories(categoryIds: string[]): Promise<{
    categoryId: Types.ObjectId;
    categoryIds: Types.ObjectId[];
    categoryPath: Types.ObjectId[];
  }> {
    const unique = [...new Set(categoryIds.filter(Boolean))];
    if (unique.length === 0) {
      throw new BadRequestException('At least one category is required');
    }

    const resolvedIds: Types.ObjectId[] = [];
    const pathKeys = new Set<string>();

    for (const id of unique) {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid category id');
      }
      const category = await this.categoryModel.findById(id).exec();
      if (!category) {
        throw new BadRequestException('Category not found');
      }
      resolvedIds.push(category._id);
      for (const ancestor of category.path) {
        pathKeys.add(String(ancestor));
      }
      pathKeys.add(String(category._id));
    }

    const primary = resolvedIds[0];
    if (!primary) {
      throw new BadRequestException('At least one category is required');
    }

    return {
      categoryId: primary,
      categoryIds: resolvedIds,
      categoryPath: [...pathKeys].map((id) => new Types.ObjectId(id)),
    };
  }

  async getAdminTree(): Promise<CategoryTreeNode[]> {
    const tree = await this.buildTree({});
    const counts = await this.productModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $project: {
            ids: {
              $setUnion: [
                [{ $ifNull: ['$categoryId', null] }],
                { $ifNull: ['$categoryIds', []] },
              ],
            },
          },
        },
        { $unwind: '$ids' },
        { $match: { ids: { $ne: null } } },
        { $group: { _id: '$ids', count: { $sum: 1 } } },
      ])
      .exec();
    const countMap = new Map(
      counts.map((row) => [String(row._id), row.count]),
    );

    const attachCounts = (nodes: CategoryTreeNode[]): CategoryTreeNode[] =>
      nodes.map((node) => ({
        ...node,
        productCount: countMap.get(node.id) ?? 0,
        children: attachCounts(node.children),
      }));

    return attachCounts(tree);
  }

  async getTree(): Promise<CategoryTreeNode[]> {
    return this.buildTree({ isActive: true });
  }

  private async buildTree(
    filter: Record<string, unknown>,
  ): Promise<CategoryTreeNode[]> {
    const categories = await this.categoryModel
      .find(filter)
      .sort({ depth: 1, order: 1, name: 1 })
      .lean()
      .exec();

    const nodes = new Map<string, CategoryTreeNode>();
    for (const cat of categories) {
      const id = String(cat._id);
      nodes.set(id, {
        _id: id,
        id,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId ? String(cat.parentId) : null,
        depth: cat.depth,
        order: cat.order,
        isActive: cat.isActive ?? true,
        seo: cat.seo,
        children: [],
      });
    }

    const roots: CategoryTreeNode[] = [];
    for (const cat of categories) {
      const node = nodes.get(String(cat._id));
      if (!node) continue;
      const parentId = cat.parentId ? String(cat.parentId) : null;
      const parent = parentId ? nodes.get(parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
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
