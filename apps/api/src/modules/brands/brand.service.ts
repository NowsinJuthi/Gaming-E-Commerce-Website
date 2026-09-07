import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { slugify } from '../../common/utils/slugify';
import { Brand, BrandDocument } from '../../database/schemas/brand.schema';
import { EventsService } from '../../shared/events/events.service';
import { AppEvent } from '../../shared/events/events.types';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandService {
  constructor(
    @InjectModel(Brand.name) private readonly brandModel: Model<BrandDocument>,
    private readonly events: EventsService,
  ) {}

  async create(dto: CreateBrandDto): Promise<BrandDocument> {
    const slug = await this.uniqueSlug(slugify(dto.slug ?? dto.name));
    const created = await this.brandModel.create({
      name: dto.name,
      slug,
      logoUrl: dto.logoUrl,
      description: dto.description,
      isActive: dto.isActive ?? true,
      seo: dto.seo,
    });
    this.events.emit(AppEvent.BrandCreated, { id: String(created._id), name: created.name });
    return created;
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandDocument> {
    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.logoUrl !== undefined) update.logoUrl = dto.logoUrl;
    if (dto.description !== undefined) update.description = dto.description;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.seo !== undefined) update.seo = dto.seo;
    if (dto.slug !== undefined) {
      update.slug = await this.uniqueSlug(slugify(dto.slug), id);
    }

    const brand = await this.brandModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .exec();
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    this.events.emit(AppEvent.BrandUpdated, { id: String(brand._id), name: brand.name });
    return brand;
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.brandModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Brand not found');
    }
    this.events.emit(AppEvent.BrandDeleted, { id });
    return { success: true };
  }

  list(): Promise<BrandDocument[]> {
    return this.brandModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  async findBySlug(slug: string): Promise<BrandDocument> {
    const brand = await this.brandModel
      .findOne({ slug: slug.toLowerCase() })
      .exec();
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }

  async assertExists(id: string): Promise<void> {
    const exists = await this.brandModel
      .exists({ _id: new Types.ObjectId(id) })
      .catch(() => null);
    if (!exists) {
      throw new BadRequestException('Brand not found');
    }
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = base || 'brand';
    let candidate = root;
    let suffix = 1;
    while (true) {
      const existing = await this.brandModel
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
