import { DEFAULT_CURRENCY } from '@uniqbd/types';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SupplierCode } from '../../common/enums';
import {
  SupplierProduct,
  SupplierProductDocument,
} from '../../database/schemas/supplier-product.schema';
import { Supplier, SupplierDocument } from '../../database/schemas/supplier.schema';
import { SupplierRegistry } from '../../integrations/suppliers/supplier.registry';
import { SupplierBalance } from '../../integrations/suppliers/supplier-client.interface';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpsertSupplierDto } from './dto/upsert-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(SupplierProduct.name)
    private readonly offeringModel: Model<SupplierProductDocument>,
    private readonly registry: SupplierRegistry,
  ) {}

  // --- Suppliers ---

  listSuppliers(): Promise<SupplierDocument[]> {
    return this.supplierModel.find().sort({ priority: 1 }).exec();
  }

  async upsertSupplier(dto: UpsertSupplierDto): Promise<SupplierDocument> {
    const supplier = await this.supplierModel
      .findOneAndUpdate(
        { code: dto.code },
        {
          $set: {
            name: dto.name,
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
            ...(dto.supportedRegions !== undefined
              ? { supportedRegions: dto.supportedRegions }
              : {}),
            ...(dto.supportedCurrencies !== undefined
              ? { supportedCurrencies: dto.supportedCurrencies }
              : {}),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    if (!supplier) {
      throw new Error('Supplier upsert failed');
    }
    return supplier;
  }

  async updateSupplier(
    code: SupplierCode,
    dto: UpdateSupplierDto,
  ): Promise<SupplierDocument> {
    const supplier = await this.supplierModel
      .findOneAndUpdate({ code }, { $set: dto }, { new: true })
      .exec();
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async refreshBalance(code: SupplierCode): Promise<SupplierBalance> {
    const client = this.registry.get(code);
    const balance = await client.getBalance();
    await this.supplierModel
      .updateOne(
        { code },
        {
          $set: {
            lastBalance: balance.balance,
            lastBalanceCurrency: balance.currency,
            lastHealthyAt: new Date(),
          },
        },
      )
      .exec();
    return balance;
  }

  // --- Offerings (product mappings) ---

  async createOffering(
    dto: CreateOfferingDto,
  ): Promise<SupplierProductDocument> {
    if (!dto.productId && !dto.sku) {
      throw new BadRequestException('Provide productId or sku');
    }
    return this.offeringModel.create({
      supplierCode: dto.supplierCode,
      productId: dto.productId ? new Types.ObjectId(dto.productId) : undefined,
      sku: dto.sku,
      externalProductId: dto.externalProductId,
      cost: dto.cost,
      currency: dto.currency ?? DEFAULT_CURRENCY,
      region: dto.region,
      enabled: dto.enabled ?? true,
      ...(dto.stockStatus ? { stockStatus: dto.stockStatus } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
    });
  }

  async updateOffering(
    id: string,
    dto: UpdateOfferingDto,
  ): Promise<SupplierProductDocument> {
    const offering = await this.offeringModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!offering) {
      throw new NotFoundException('Offering not found');
    }
    return offering;
  }

  async deleteOffering(id: string): Promise<{ deleted: boolean }> {
    const result = await this.offeringModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Offering not found');
    }
    return { deleted: true };
  }

  listOfferings(productId?: string): Promise<SupplierProductDocument[]> {
    const filter = productId
      ? { productId: new Types.ObjectId(productId) }
      : {};
    return this.offeringModel.find(filter).sort({ priority: 1, cost: 1 }).exec();
  }
}
