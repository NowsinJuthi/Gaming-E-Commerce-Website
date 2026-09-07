import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MfsProvider } from '../../common/enums';
import {
  MfsGateway,
  MfsGatewayDocument,
} from '../../database/schemas/mfs-gateway.schema';
import {
  CreateMfsGatewayDto,
  UpdateMfsGatewayDto,
} from './dto/mfs.dto';
import {
  MFS_PROVIDER_INSTRUCTIONS,
  MFS_PROVIDER_LABELS,
} from './mfs-sms.parser';

export type MfsGatewayView = {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
  phoneNumber: string;
  qrCodeUrl?: string;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
  sortOrder: number;
  instructions?: string;
  defaultInstructions: string;
};

@Injectable()
export class MfsGatewayService implements OnModuleInit {
  private readonly logger = new Logger(MfsGatewayService.name);

  constructor(
    @InjectModel(MfsGateway.name)
    private readonly gatewayModel: Model<MfsGatewayDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultGateways();
  }

  /** Ensure default bKash/Nagad rows exist (adds any missing providers). */
  private async ensureDefaultGateways(): Promise<void> {
    const bkashNumber =
      process.env.MFS_DEFAULT_BKASH_NUMBER?.trim() || '01700000001';
    const nagadNumber =
      process.env.MFS_DEFAULT_NAGAD_NUMBER?.trim() || '01700000002';

    const defaults = [
      {
        name: 'bKash',
        provider: MfsProvider.Bkash,
        phoneNumber: bkashNumber,
        minAmount: 10,
        maxAmount: 100000,
        isActive: true,
        sortOrder: 0,
      },
      {
        name: 'Nagad',
        provider: MfsProvider.Nagad,
        phoneNumber: nagadNumber,
        minAmount: 10,
        maxAmount: 100000,
        isActive: true,
        sortOrder: 1,
      },
    ] as const;

    let created = 0;
    for (const row of defaults) {
      const exists = await this.gatewayModel
        .exists({ provider: row.provider })
        .exec();
      if (exists) continue;
      await this.gatewayModel.create(row);
      created += 1;
    }

    if (created > 0) {
      this.logger.log(
        `Seeded ${created} default MFS gateway(s) — update wallet numbers in Admin → Settings → MFS gateways`,
      );
    }
  }

  toView(doc: MfsGatewayDocument): MfsGatewayView {
    return {
      id: String(doc._id),
      name: doc.name,
      provider: doc.provider,
      providerLabel: MFS_PROVIDER_LABELS[doc.provider],
      phoneNumber: doc.phoneNumber,
      qrCodeUrl: doc.qrCodeUrl,
      minAmount: doc.minAmount,
      maxAmount: doc.maxAmount,
      isActive: doc.isActive,
      sortOrder: doc.sortOrder,
      instructions: doc.instructions,
      defaultInstructions: MFS_PROVIDER_INSTRUCTIONS[doc.provider],
    };
  }

  async listActive(): Promise<MfsGatewayView[]> {
    const rows = await this.gatewayModel
      .find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .exec();
    return rows.map((row) => this.toView(row));
  }

  async listAll(): Promise<MfsGatewayView[]> {
    const rows = await this.gatewayModel
      .find()
      .sort({ sortOrder: 1, name: 1 })
      .exec();
    return rows.map((row) => this.toView(row));
  }

  async getById(id: string): Promise<MfsGatewayDocument> {
    const row = await this.gatewayModel.findById(id).exec();
    if (!row) throw new NotFoundException('MFS gateway not found');
    return row;
  }

  async create(dto: CreateMfsGatewayDto): Promise<MfsGatewayView> {
    if ((dto.maxAmount ?? 100000) < (dto.minAmount ?? 10)) {
      throw new BadRequestException('maxAmount must be >= minAmount');
    }
    const row = await this.gatewayModel.create({
      name: dto.name.trim(),
      provider: dto.provider,
      phoneNumber: dto.phoneNumber.trim(),
      qrCodeUrl: dto.qrCodeUrl?.trim(),
      minAmount: dto.minAmount ?? 10,
      maxAmount: dto.maxAmount ?? 100000,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      instructions: dto.instructions?.trim(),
    });
    return this.toView(row);
  }

  async update(id: string, dto: UpdateMfsGatewayDto): Promise<MfsGatewayView> {
    const row = await this.getById(id);
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.provider !== undefined) row.provider = dto.provider;
    if (dto.phoneNumber !== undefined) row.phoneNumber = dto.phoneNumber.trim();
    if (dto.qrCodeUrl !== undefined) row.qrCodeUrl = dto.qrCodeUrl.trim();
    if (dto.minAmount !== undefined) row.minAmount = dto.minAmount;
    if (dto.maxAmount !== undefined) row.maxAmount = dto.maxAmount;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.instructions !== undefined) row.instructions = dto.instructions.trim();
    if (row.maxAmount < row.minAmount) {
      throw new BadRequestException('maxAmount must be >= minAmount');
    }
    await row.save();
    return this.toView(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.getById(id);
    await row.deleteOne();
  }

  assertAmountAllowed(
    gateway: MfsGatewayDocument,
    amount: number,
  ): void {
    if (amount < gateway.minAmount || amount > gateway.maxAmount) {
      throw new BadRequestException(
        `Amount must be between ${gateway.minAmount} and ${gateway.maxAmount} BDT for ${gateway.name}`,
      );
    }
  }
}
