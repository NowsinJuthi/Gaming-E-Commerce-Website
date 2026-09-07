import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductStatus } from '../../common/enums';
import { Product, ProductDocument } from '../../database/schemas/product.schema';
import {
  WishlistItem,
  WishlistItemDocument,
} from '../../database/schemas/wishlist-item.schema';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(WishlistItem.name)
    private readonly wishlistModel: Model<WishlistItemDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async list(userId: string) {
    const items = await this.wishlistModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (items.length === 0) return [];

    const productIds = items.map((i) => i.productId);
    const products = await this.productModel
      .find({ _id: { $in: productIds }, status: ProductStatus.Active })
      .select('title slug pricing media stock')
      .lean()
      .exec();

    const byId = new Map(products.map((p) => [String(p._id), p]));

    return items
      .map((item) => {
        const product = byId.get(String(item.productId));
        if (!product) return null;
        return {
          _id: String(item._id),
          productId: String(item.productId),
          createdAt: item.createdAt,
          product: {
            _id: String(product._id),
            title: product.title,
            slug: product.slug,
            pricing: product.pricing,
            media: product.media,
            stock: product.stock,
          },
        };
      })
      .filter(Boolean);
  }

  async add(userId: string, productId: string) {
    const product = await this.productModel.findById(productId).exec();
    if (!product || product.status !== ProductStatus.Active) {
      throw new NotFoundException('Product not found');
    }

    try {
      await this.wishlistModel.create({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      });
    } catch {
      /* duplicate — already wishlisted */
    }

    return { added: true, productId };
  }

  async remove(userId: string, productId: string) {
    await this.wishlistModel
      .deleteOne({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      })
      .exec();
    return { removed: true };
  }
}
