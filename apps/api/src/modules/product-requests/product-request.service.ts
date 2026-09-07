import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { isEphemeralGuestUser } from '../../common/utils/guest-user';
import {
  ProductRequest,
  ProductRequestDocument,
} from '../../database/schemas/product-request.schema';
import { MailerService } from '../../integrations/mail/mailer.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateProductRequestDto } from './dto/create-product-request.dto';

@Injectable()
export class ProductRequestService {
  private readonly logger = new Logger(ProductRequestService.name);

  constructor(
    @InjectModel(ProductRequest.name)
    private readonly requestModel: Model<ProductRequestDocument>,
    private readonly mailer: MailerService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateProductRequestDto,
  ): Promise<Record<string, unknown>> {
    if (user.isGuest || isEphemeralGuestUser(user)) {
      throw new ForbiddenException(
        'Login is required to submit a product request',
      );
    }
    const doc = await this.requestModel.create({
      userId: new Types.ObjectId(user.id),
      productName: dto.productName.trim(),
      customerName: dto.customerName.trim(),
      email: dto.email.trim().toLowerCase(),
      mobile: dto.mobile.trim(),
      details: dto.details.trim(),
    });
    return this.serialize(doc);
  }

  async listForAdmin(
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { page, limit } = pagination;
    const [docs, total] = await Promise.all([
      this.requestModel
        .find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.requestModel.countDocuments().exec(),
    ]);
    return {
      items: docs.map((doc) => this.serialize(doc)),
      total,
      page,
      limit,
    };
  }

  async reply(id: string, message: string): Promise<Record<string, unknown>> {
    const doc = await this.findOrThrow(id);
    doc.adminReply = message.trim();
    doc.repliedAt = new Date();
    await doc.save();

    // Send the email in the background so the admin gets an instant response
    // (SMTP round-trips can take several seconds).
    void this.mailer
      .sendProductRequestReply(doc.email, {
        name: doc.customerName,
        productName: doc.productName,
        message: doc.adminReply,
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Failed to email product request reply to ${doc.email}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });

    return this.serialize(doc);
  }

  async remove(id: string): Promise<{ success: true }> {
    const doc = await this.findOrThrow(id);
    await doc.deleteOne();
    return { success: true };
  }

  private async findOrThrow(id: string): Promise<ProductRequestDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Product request not found');
    }
    const doc = await this.requestModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('Product request not found');
    }
    return doc;
  }

  private serialize(doc: ProductRequestDocument): Record<string, unknown> {
    return {
      id: String(doc._id),
      userId: String(doc.userId),
      productName: doc.productName,
      customerName: doc.customerName,
      email: doc.email,
      mobile: doc.mobile,
      details: doc.details,
      adminReply: doc.adminReply,
      repliedAt: doc.repliedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
