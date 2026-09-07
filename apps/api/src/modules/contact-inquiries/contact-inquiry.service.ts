import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import {
  ContactInquiry,
  ContactInquiryDocument,
  ContactInquiryStatus,
} from '../../database/schemas/contact-inquiry.schema';
import { MailerService } from '../../integrations/mail/mailer.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class ContactInquiryService {
  private readonly logger = new Logger(ContactInquiryService.name);

  constructor(
    @InjectModel(ContactInquiry.name)
    private readonly inquiryModel: Model<ContactInquiryDocument>,
    private readonly mailer: MailerService,
  ) {}

  async createFromPublicForm(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<Record<string, unknown>> {
    const now = new Date();
    const doc = await this.inquiryModel.create({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      subject: data.subject.trim(),
      status: 'new',
      lastMessageAt: now,
      messages: [
        {
          direction: 'inbound',
          body: data.message.trim(),
          sentAt: now,
        },
      ],
    });
    return this.serialize(doc);
  }

  async listForAdmin(
    pagination: PaginationDto,
    status?: ContactInquiryStatus,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { page, limit } = pagination;
    const filter = status ? { status } : {};
    const [docs, total] = await Promise.all([
      this.inquiryModel
        .find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.inquiryModel.countDocuments(filter).exec(),
    ]);
    return {
      items: docs.map((doc) => this.serialize(doc)),
      total,
      page,
      limit,
    };
  }

  async getForAdmin(id: string): Promise<Record<string, unknown>> {
    const doc = await this.findOrThrow(id);
    if (doc.status === 'new') {
      doc.status = 'read';
      doc.readAt = new Date();
      await doc.save();
    }
    return this.serialize(doc);
  }

  async reply(
    id: string,
    message: string,
    admin: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const doc = await this.findOrThrow(id);
    const trimmed = message.trim();
    const now = new Date();

    doc.messages.push({
      direction: 'outbound',
      body: trimmed,
      adminId: new Types.ObjectId(admin.id),
      sentAt: now,
    });
    doc.status = 'replied';
    doc.lastMessageAt = now;
    if (!doc.readAt) {
      doc.readAt = now;
    }
    await doc.save();

    void this.mailer
      .sendContactInquiryReply(doc.email, {
        name: doc.name,
        subject: doc.subject,
        message: trimmed,
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Failed to email contact inquiry reply to ${doc.email}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });

    return this.serialize(doc);
  }

  async updateStatus(
    id: string,
    status: ContactInquiryStatus,
  ): Promise<Record<string, unknown>> {
    const doc = await this.findOrThrow(id);
    doc.status = status;
    if (status === 'read' && !doc.readAt) {
      doc.readAt = new Date();
    }
    await doc.save();
    return this.serialize(doc);
  }

  async remove(id: string): Promise<{ success: true }> {
    const doc = await this.findOrThrow(id);
    await doc.deleteOne();
    return { success: true };
  }

  async countNew(): Promise<number> {
    return this.inquiryModel.countDocuments({ status: 'new' }).exec();
  }

  private async findOrThrow(id: string): Promise<ContactInquiryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Contact message not found');
    }
    const doc = await this.inquiryModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('Contact message not found');
    }
    return doc;
  }

  private serialize(doc: ContactInquiryDocument): Record<string, unknown> {
    const firstInbound = doc.messages.find((m) => m.direction === 'inbound');
    const lastOutbound = [...doc.messages]
      .reverse()
      .find((m) => m.direction === 'outbound');

    return {
      id: String(doc._id),
      name: doc.name,
      email: doc.email,
      subject: doc.subject,
      status: doc.status,
      message: firstInbound?.body ?? '',
      adminReply: lastOutbound?.body,
      repliedAt: lastOutbound?.sentAt,
      readAt: doc.readAt,
      lastMessageAt: doc.lastMessageAt,
      messages: doc.messages.map((m, index) => ({
        id: m._id ? String(m._id) : `${String(doc._id)}-${index}`,
        direction: m.direction,
        body: m.body,
        adminId: m.adminId ? String(m.adminId) : undefined,
        sentAt: m.sentAt,
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
