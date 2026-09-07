import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginatedResult } from '../common/dto/pagination.dto';
import {
  AccessBlock,
  AccessBlockDocument,
  AccessBlockType,
} from '../database/schemas/access-block.schema';
import { AuditActorType } from '../database/schemas/audit-log.schema';
import { AuditService } from '../shared/audit/audit.service';
import type { AuthenticatedUser } from '../modules/auth/auth.types';
import {
  assertValidAccessBlockValue,
  normalizeAccessBlockValue,
} from './access-block.utils';
import { CreateAccessBlockDto } from './dto/create-access-block.dto';
import { QueryAccessBlocksDto } from './dto/query-access-blocks.dto';

const CACHE_MS = 30_000;

interface ActiveBlockSnapshot {
  ips: Set<string>;
  countries: Set<string>;
  expires: number;
}

export interface AccessBlockItem {
  _id: string;
  type: AccessBlockType;
  value: string;
  active: boolean;
  reason?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AccessBlockCheckResult {
  blocked: boolean;
  type?: AccessBlockType;
  value?: string;
}

@Injectable()
export class AccessBlockService {
  private snapshot: ActiveBlockSnapshot | null = null;

  constructor(
    @InjectModel(AccessBlock.name)
    private readonly blockModel: Model<AccessBlockDocument>,
    private readonly audit: AuditService,
  ) {}

  invalidateCache(): void {
    this.snapshot = null;
  }

  async list(
    query: QueryAccessBlocksDto,
  ): Promise<PaginatedResult<AccessBlockItem>> {
    const filter: Record<string, unknown> = { active: true };
    if (query.type) {
      filter.type = query.type;
    }

    const { page, limit } = query;
    const [items, total] = await Promise.all([
      this.blockModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.blockModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((item) => this.toItemFromLean(item)),
      total,
      page,
      limit,
    };
  }

  async counts(): Promise<{ ip: number; country: number; total: number }> {
    const [ip, country] = await Promise.all([
      this.blockModel.countDocuments({ active: true, type: 'ip' }).exec(),
      this.blockModel
        .countDocuments({ active: true, type: 'country' })
        .exec(),
    ]);
    return { ip, country, total: ip + country };
  }

  async block(
    dto: CreateAccessBlockDto,
    actor?: AuthenticatedUser,
    actorIp?: string,
  ): Promise<AccessBlockItem> {
    const value = assertValidAccessBlockValue(dto.type, dto.value);
    const reason = dto.reason?.trim() || undefined;

    let doc = await this.blockModel
      .findOne({ type: dto.type, value })
      .exec();

    if (doc) {
      if (doc.active) {
        throw new BadRequestException(
          `${dto.type === 'ip' ? 'IP' : 'Country'} is already blocked.`,
        );
      }
      doc.active = true;
      doc.reason = reason ?? doc.reason;
      doc.createdBy = actor?.email ?? doc.createdBy;
      await doc.save();
    } else {
      doc = await this.blockModel.create({
        type: dto.type,
        value,
        active: true,
        reason,
        createdBy: actor?.email,
      });
    }

    this.invalidateCache();
    await this.audit.record({
      action: 'security.access_block',
      actorType: actor ? AuditActorType.User : AuditActorType.System,
      actorId: actor?.id,
      entityType: 'access_block',
      entityId: String(doc._id),
      status: 'blocked',
      ip: actorIp,
      metadata: { type: dto.type, value, reason },
    });

    return this.toItem(doc);
  }

  async unblock(
    id: string,
    actor?: AuthenticatedUser,
    actorIp?: string,
  ): Promise<AccessBlockItem> {
    const doc = await this.blockModel.findById(id).exec();
    if (!doc || !doc.active) {
      throw new NotFoundException('Block rule not found.');
    }

    doc.active = false;
    await doc.save();
    this.invalidateCache();

    await this.audit.record({
      action: 'security.access_unblock',
      actorType: actor ? AuditActorType.User : AuditActorType.System,
      actorId: actor?.id,
      entityType: 'access_block',
      entityId: String(doc._id),
      status: 'unblocked',
      ip: actorIp,
      metadata: { type: doc.type, value: doc.value },
    });

    return this.toItem(doc);
  }

  async check(ip?: string, country?: string): Promise<AccessBlockCheckResult> {
    const snapshot = await this.getActiveSnapshot();
    const normalizedIp = ip?.trim();
    if (normalizedIp && snapshot.ips.has(normalizedIp)) {
      return { blocked: true, type: 'ip', value: normalizedIp };
    }

    const normalizedCountry = country?.trim().toUpperCase();
    if (
      normalizedCountry &&
      normalizedCountry !== 'XX' &&
      normalizedCountry !== 'T1' &&
      snapshot.countries.has(normalizedCountry)
    ) {
      return {
        blocked: true,
        type: 'country',
        value: normalizedCountry,
      };
    }

    return { blocked: false };
  }

  private async getActiveSnapshot(): Promise<ActiveBlockSnapshot> {
    if (this.snapshot && Date.now() < this.snapshot.expires) {
      return this.snapshot;
    }

    const rows = await this.blockModel
      .find({ active: true })
      .select('type value')
      .lean()
      .exec();

    const ips = new Set<string>();
    const countries = new Set<string>();
    for (const row of rows) {
      const value = normalizeAccessBlockValue(row.type, row.value);
      if (row.type === 'ip') {
        ips.add(value);
      } else {
        countries.add(value);
      }
    }

    this.snapshot = {
      ips,
      countries,
      expires: Date.now() + CACHE_MS,
    };
    return this.snapshot;
  }

  private toItem(doc: AccessBlockDocument): AccessBlockItem {
    return this.toItemFromLean(doc);
  }

  private toItemFromLean(
    doc: Pick<
      AccessBlock,
      'type' | 'value' | 'active' | 'reason' | 'createdBy' | 'createdAt' | 'updatedAt'
    > & { _id: { toString(): string } },
  ): AccessBlockItem {
    return {
      _id: String(doc._id),
      type: doc.type,
      value: doc.value,
      active: doc.active,
      reason: doc.reason,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
