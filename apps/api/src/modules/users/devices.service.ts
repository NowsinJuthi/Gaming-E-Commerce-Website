import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuthSession,
  AuthSessionDocument,
} from '../../database/schemas/auth-session.schema';

export interface DeviceView {
  id: string;
  ip?: string;
  userAgent?: string;
  createdAt?: Date;
  expiresAt: Date;
}

/**
 * User-facing management of active sessions (devices).
 * The write side (create/rotate during login) lives in AuthService;
 * this service only reads and revokes for the owning user.
 */
@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(AuthSession.name)
    private readonly sessionModel: Model<AuthSessionDocument>,
  ) {}

  async listForUser(userId: string): Promise<DeviceView[]> {
    const sessions = await this.sessionModel
      .find({
        userId: new Types.ObjectId(userId),
        revoked: false,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .exec();

    return sessions.map((session) => ({
      id: String(session._id),
      ip: session.ip,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  async revoke(
    userId: string,
    sessionId: Types.ObjectId,
  ): Promise<{ success: boolean }> {
    const result = await this.sessionModel
      .updateOne(
        { _id: sessionId, userId: new Types.ObjectId(userId) },
        { $set: { revoked: true } },
      )
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException('Device not found');
    }
    return { success: true };
  }

  async revokeAll(userId: string): Promise<{ success: boolean }> {
    await this.sessionModel
      .updateMany(
        { userId: new Types.ObjectId(userId), revoked: false },
        { $set: { revoked: true } },
      )
      .exec();
    return { success: true };
  }
}
