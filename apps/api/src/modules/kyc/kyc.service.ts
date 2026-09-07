import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { KycDocumentType, KycStatus } from '../../common/enums';
import { escapeRegex } from '../../common/utils/escape-regex';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import {
  KycDocument,
  KycDocumentEntity,
} from '../../database/schemas/kyc-document.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { QueryKycRequestsDto } from './dto/query-kyc-requests.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

export interface KycOverview {
  status: KycStatus;
  documents: KycDocumentEntity[];
}

export interface AdminKycOverview {
  pending: number;
  verified: number;
  rejected: number;
  total: number;
}

export interface AdminKycRequestView {
  _id: string;
  userId: string;
  email?: string;
  displayName?: string;
  documentType: KycDocumentType;
  fileUrls: string[];
  status: KycStatus;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class KycService {
  constructor(
    @InjectModel(KycDocument.name)
    private readonly kycModel: Model<KycDocumentEntity>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly users: UsersService,
  ) {}

  async submit(
    userId: string,
    dto: SubmitKycDto,
  ): Promise<KycDocumentEntity> {
    const document = await this.kycModel.create({
      userId: new Types.ObjectId(userId),
      documentType: dto.documentType,
      fileUrls: dto.fileUrls,
      status: KycStatus.Pending,
    });
    await this.users.setKycStatus(userId, KycStatus.Pending);
    return document;
  }

  async getForUser(userId: string): Promise<KycOverview> {
    const [documents, user] = await Promise.all([
      this.kycModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .exec(),
      this.users.findById(userId),
    ]);
    return {
      status: user?.kycStatus ?? KycStatus.None,
      documents,
    };
  }

  async adminOverview(): Promise<AdminKycOverview> {
    const [pending, verified, rejected, total] = await Promise.all([
      this.kycModel.countDocuments({ status: KycStatus.Pending }).exec(),
      this.kycModel.countDocuments({ status: KycStatus.Verified }).exec(),
      this.kycModel.countDocuments({ status: KycStatus.Rejected }).exec(),
      this.kycModel.countDocuments().exec(),
    ]);
    return { pending, verified, rejected, total };
  }

  async adminListRequests(
    query: QueryKycRequestsDto,
  ): Promise<PaginatedResult<AdminKycRequestView>> {
    const filter: FilterQuery<KycDocumentEntity> = {};
    if (query.status) filter.status = query.status;

    const q = query.q?.trim();
    if (q) {
      const escaped = escapeRegex(q);
      const users = await this.userModel
        .find({
          $or: [
            { email: { $regex: escaped, $options: 'i' } },
            { 'profile.firstName': { $regex: escaped, $options: 'i' } },
            { 'profile.lastName': { $regex: escaped, $options: 'i' } },
            { 'profile.displayName': { $regex: escaped, $options: 'i' } },
          ],
        })
        .select('_id')
        .limit(100)
        .lean()
        .exec();
      const userIds = users.map((u) => u._id);
      if (userIds.length === 0) {
        return { items: [], total: 0, page: query.page, limit: query.limit };
      }
      filter.userId = { $in: userIds };
    }

    const { page, limit } = query;
    const [docs, total] = await Promise.all([
      this.kycModel
        .find(filter)
        .sort({ status: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.kycModel.countDocuments(filter).exec(),
    ]);

    const userIds = [...new Set(docs.map((d) => String(d.userId)))];
    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('email profile.displayName profile.firstName profile.lastName')
      .lean()
      .exec();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const items: AdminKycRequestView[] = docs.map((doc) => {
      const user = userMap.get(String(doc.userId));
      return {
        _id: String(doc._id),
        userId: String(doc.userId),
        email: user?.email,
        displayName:
          user?.profile?.displayName ||
          [user?.profile?.firstName, user?.profile?.lastName]
            .filter(Boolean)
            .join(' ') ||
          undefined,
        documentType: doc.documentType,
        fileUrls: doc.fileUrls ?? [],
        status: doc.status,
        rejectionReason: doc.rejectionReason,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    return { items, total, page, limit };
  }

  async adminApproveRequest(
    id: string,
    adminId: string,
  ): Promise<AdminKycRequestView> {
    const doc = await this.kycModel.findById(id).exec();
    if (!doc) throw new NotFoundException('KYC request not found.');
    if (doc.status !== KycStatus.Pending) {
      throw new BadRequestException('Only pending requests can be approved.');
    }

    doc.status = KycStatus.Verified;
    doc.reviewedBy = new Types.ObjectId(adminId);
    doc.rejectionReason = undefined;
    await doc.save();
    await this.users.setKycStatus(String(doc.userId), KycStatus.Verified);

    const user = await this.userModel
      .findById(doc.userId)
      .select('email profile.displayName profile.firstName profile.lastName')
      .lean()
      .exec();

    return {
      _id: String(doc._id),
      userId: String(doc.userId),
      email: user?.email,
      displayName:
        user?.profile?.displayName ||
        [user?.profile?.firstName, user?.profile?.lastName]
          .filter(Boolean)
          .join(' ') ||
        undefined,
      documentType: doc.documentType,
      fileUrls: doc.fileUrls ?? [],
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async adminRejectRequest(
    id: string,
    adminId: string,
    rejectionReason?: string,
  ): Promise<AdminKycRequestView> {
    const doc = await this.kycModel.findById(id).exec();
    if (!doc) throw new NotFoundException('KYC request not found.');
    if (doc.status !== KycStatus.Pending) {
      throw new BadRequestException('Only pending requests can be rejected.');
    }

    doc.status = KycStatus.Rejected;
    doc.reviewedBy = new Types.ObjectId(adminId);
    doc.rejectionReason = rejectionReason?.trim() || undefined;
    await doc.save();
    await this.users.setKycStatus(String(doc.userId), KycStatus.Rejected);

    const user = await this.userModel
      .findById(doc.userId)
      .select('email profile.displayName profile.firstName profile.lastName')
      .lean()
      .exec();

    return {
      _id: String(doc._id),
      userId: String(doc.userId),
      email: user?.email,
      displayName:
        user?.profile?.displayName ||
        [user?.profile?.firstName, user?.profile?.lastName]
          .filter(Boolean)
          .join(' ') ||
        undefined,
      documentType: doc.documentType,
      fileUrls: doc.fileUrls ?? [],
      status: doc.status,
      rejectionReason: doc.rejectionReason,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
