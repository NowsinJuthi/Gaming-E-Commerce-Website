import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { KycStatus, NotificationEvent, Role, UserStatus } from '../../common/enums';
import { round2 } from '../../common/utils/money';
import { escapeRegex } from '../../common/utils/escape-regex';
import {
  guestSessionAccountEmailFilter,
  isGuestSessionAccount,
} from '../../common/utils/guest-user';
import {
  expandRoleFilter,
  isAdministratorRole,
  normalizeAssignedRoles,
} from '../../common/utils/role.utils';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  User,
  UserDocument,
  UserProfile,
} from '../../database/schemas/user.schema';
import { Wallet, WalletDocument } from '../../database/schemas/wallet.schema';
import { MailService } from '../../integrations/mail/mail.service';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminCustomerEmailDto } from './dto/admin-customer-email.dto';
import { AdminCustomerNoteDto } from './dto/admin-customer-note.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DevicesService } from './devices.service';

interface CreateUserData {
  email: string;
  passwordHash?: string;
  roles?: Role[];
}

export interface UserProfileView {
  id: string;
  email: string;
  phone?: string;
  roles: Role[];
  status: UserStatus;
  emailVerified: boolean;
  kycStatus: KycStatus;
  profile: UserProfile;
  createdAt?: Date;
  wallet?: { balance: number; currency: string };
  adminNote?: string;
  /** Storefront — instant-delivery catalog access via role permissions. */
  autoDelivery?: boolean;
}

const PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'displayName',
  'avatarUrl',
  'country',
  'locale',
  'timezone',
  'bio',
] as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    private readonly crypto: CryptoService,
    private readonly devices: DevicesService,
    private readonly mail: MailService,
    private readonly uploads: UploadsService,
    @Inject(forwardRef(() => NotificationDispatcher))
    private readonly dispatcher: NotificationDispatcher,
    private readonly rolePermissions: RolePermissionsService,
  ) {}

  create(data: CreateUserData): Promise<UserDocument> {
    return this.userModel.create({
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      roles: data.roles ?? [Role.Customer],
      status: UserStatus.Pending,
    });
  }

  createGuestUser(displayName?: string): Promise<UserDocument> {
    const email = `guest_${randomUUID()}@guest.local`;
    return this.userModel.create({
      email,
      roles: [Role.Guest],
      status: UserStatus.Active,
      emailVerified: false,
      isGuest: true,
      ...(displayName ? { profile: { displayName: displayName.slice(0, 60) } } : {}),
    });
  }

  /** Registered accounts only — guest checkout sessions are excluded. */
  private registeredCustomersFilter(): FilterQuery<UserDocument> {
    return {
      isGuest: { $ne: true },
      ...guestSessionAccountEmailFilter(),
    };
  }

  /**
   * After guest checkout payment, revoke login and anonymize the ephemeral user
   * so it does not remain a customer account.
   */
  async finalizeEphemeralGuest(
    userId: string,
    orderNumber?: string,
  ): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user?.isGuest) return;

    await this.devices.revokeAll(userId);

    const suffix = orderNumber?.trim() || String(user._id);
    await this.userModel
      .updateOne(
        { _id: userId, isGuest: true },
        {
          $set: {
            email: `guest+${suffix}@removed.local`,
            status: UserStatus.Banned,
            profile: {},
          },
          $unset: { phone: '' },
        },
      )
      .exec();
  }

  findByEmail(
    email: string,
    withPassword = false,
  ): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ email: email.toLowerCase() });
    if (withPassword) {
      query.select('+passwordHash');
    }
    return query.exec();
  }

  findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async getProfile(userId: string): Promise<UserProfileView> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.enrichAutoDelivery(this.toProfileView(user));
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileView> {
    const update: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      const value = dto[field];
      if (value !== undefined && value !== '') {
        update[`profile.${field}`] = value;
      }
    }
    if (dto.phone !== undefined && dto.phone !== '') {
      update.phone = dto.phone;
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: update }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.enrichAutoDelivery(this.toProfileView(user));
  }

  async setAvatarUrl(
    userId: string,
    avatarUrl: string,
  ): Promise<UserProfileView> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const previous = user.profile?.avatarUrl;
    user.profile = user.profile ?? {};
    user.profile.avatarUrl = avatarUrl;
    user.markModified('profile');
    await user.save();
    if (previous && previous !== avatarUrl) {
      this.uploads.tryDeleteAvatarByUrl(previous);
    }
    return this.enrichAutoDelivery(this.toProfileView(user));
  }

  async clearAvatar(userId: string): Promise<UserProfileView> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const previous = user.profile?.avatarUrl;
    if (user.profile?.avatarUrl) {
      user.profile.avatarUrl = undefined;
      user.markModified('profile');
      await user.save();
    }
    if (previous) {
      this.uploads.tryDeleteAvatarByUrl(previous);
    }
    return this.enrichAutoDelivery(this.toProfileView(user));
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    const user = await this.userModel
      .findById(userId)
      .select('+passwordHash')
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account does not use password login. Use OTP or contact support.',
      );
    }

    const valid = await this.crypto.verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      throw new ForbiddenException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await this.crypto.hashPassword(dto.newPassword);
    await this.userModel
      .updateOne({ _id: userId }, { $set: { passwordHash } })
      .exec();
    await this.invalidateAccessSessions(userId);

    void this.dispatcher.dispatch(
      NotificationEvent.PasswordChanged,
      userId,
      {},
    );

    return { success: true };
  }

  async applyPasswordReset(
    userId: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user || user.isGuest) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await this.crypto.hashPassword(newPassword);
    await this.userModel
      .updateOne({ _id: userId }, { $set: { passwordHash } })
      .exec();
    await this.invalidateAccessSessions(userId);

    void this.dispatcher.dispatch(
      NotificationEvent.PasswordChanged,
      userId,
      {},
    );

    return { success: true };
  }

  private async invalidateAccessSessions(userId: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } })
      .exec();
    await this.devices.revokeAll(userId);
  }

  async markEmailVerified(userId: Types.ObjectId): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { emailVerified: true, status: UserStatus.Active } },
      )
      .exec();
  }

  async setKycStatus(
    userId: string | Types.ObjectId,
    status: KycStatus,
  ): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $set: { kycStatus: status } })
      .exec();
  }

  async adminOverview() {
    const registered = this.registeredCustomersFilter();
    const [total, active, pending, banned, today, customers, walletAgg, withBalance] =
      await Promise.all([
        this.userModel.countDocuments(registered).exec(),
        this.userModel
          .countDocuments({ ...registered, status: UserStatus.Active })
          .exec(),
        this.userModel
          .countDocuments({ ...registered, status: UserStatus.Pending })
          .exec(),
        this.userModel
          .countDocuments({
            ...registered,
            status: { $in: [UserStatus.Banned, UserStatus.Suspended] },
          })
          .exec(),
        this.userModel
          .countDocuments({ ...registered, createdAt: { $gte: this.dayStart() } })
          .exec(),
        this.userModel
          .countDocuments({ ...registered, roles: Role.Customer })
          .exec(),
        this.walletModel
          .aggregate<{ total: number }>([
            { $group: { _id: null, total: { $sum: '$balance' } } },
          ])
          .exec(),
        this.walletModel.countDocuments({ balance: { $gt: 0 } }).exec(),
      ]);
    return {
      total,
      active,
      pending,
      banned,
      today,
      customers,
      walletTotal: round2(walletAgg[0]?.total ?? 0),
      withBalance,
    };
  }

  async adminList(
    query: QueryAdminUsersDto,
  ): Promise<PaginatedResult<UserProfileView>> {
    const filter: FilterQuery<UserDocument> = {
      ...this.registeredCustomersFilter(),
    };
    if (query.status) filter.status = query.status;
    if (query.role) filter.roles = { $in: expandRoleFilter(query.role) };
    if (query.q?.trim()) {
      const q = escapeRegex(query.q.trim());
      filter.$or = [
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { 'profile.firstName': { $regex: q, $options: 'i' } },
        { 'profile.lastName': { $regex: q, $options: 'i' } },
        { 'profile.displayName': { $regex: q, $options: 'i' } },
      ];
    }

    if (query.hasBalance === true || query.hasBalance === false) {
      const fundedWallets = await this.walletModel
        .find({ balance: { $gt: 0 } })
        .select('userId')
        .lean()
        .exec();
      const fundedUserIds = fundedWallets.map((wallet) => wallet.userId);

      if (query.hasBalance) {
        if (fundedUserIds.length === 0) {
          return { items: [], total: 0, page: query.page, limit: query.limit };
        }
        filter._id = { $in: fundedUserIds };
      } else if (fundedUserIds.length > 0) {
        filter._id = { $nin: fundedUserIds };
      }
    }

    const { page, limit } = query;
    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    const userIds = items.map((u) => u._id);
    const wallets = await this.walletModel
      .find({ userId: { $in: userIds } })
      .exec();
    const walletByUser = new Map(
      wallets.map((w) => [String(w.userId), w]),
    );

    return {
      items: items.map((u) => {
        const view = this.toProfileView(u);
        const wallet = walletByUser.get(String(u._id));
        if (wallet) {
          view.wallet = {
            balance: wallet.balance,
            currency: wallet.currency,
          };
        }
        return view;
      }),
      total,
      page,
      limit,
    };
  }

  async adminGet(userId: string): Promise<UserProfileView> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const view = this.toProfileView(user);
    const wallet = await this.walletModel
      .findOne({ userId: user._id })
      .exec();
    if (wallet) {
      view.wallet = {
        balance: wallet.balance,
        currency: wallet.currency,
      };
    }
    return view;
  }

  async adminSaveNote(
    userId: string,
    dto: AdminCustomerNoteDto,
  ): Promise<UserProfileView> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { adminNote: dto.note.trim() } },
        { new: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.adminGet(userId);
  }

  async adminSendEmail(
    userId: string,
    dto: AdminCustomerEmailDto,
  ): Promise<{ sent: true }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.mail.sendSupportEmail(
      user.email,
      dto.subject.trim(),
      dto.message.trim(),
    );
    return { sent: true };
  }

  async adminResetPassword(
    userId: string,
    dto: AdminResetPasswordDto,
  ): Promise<{ success: true }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await this.crypto.hashPassword(dto.newPassword);
    await this.userModel
      .updateOne({ _id: userId }, { $set: { passwordHash } })
      .exec();
    await this.invalidateAccessSessions(userId);

    void this.dispatcher.dispatch(
      NotificationEvent.PasswordChanged,
      userId,
      {},
    );

    return { success: true };
  }

  async adminCreate(dto: AdminCreateUserDto): Promise<UserProfileView> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = dto.password
      ? await this.crypto.hashPassword(dto.password)
      : undefined;

    const profile: Partial<UserProfile> = {};
    if (dto.firstName) profile.firstName = dto.firstName;
    if (dto.lastName) profile.lastName = dto.lastName;

    const user = await this.userModel.create({
      email,
      passwordHash,
      phone: dto.phone,
      roles: normalizeAssignedRoles(
        dto.roles?.length ? dto.roles : [Role.Customer],
      ),
      status: dto.status ?? UserStatus.Active,
      emailVerified: dto.emailVerified ?? Boolean(dto.password),
      kycStatus: dto.kycStatus ?? KycStatus.None,
      profile,
    });

    return this.toProfileView(user);
  }

  async adminUpdate(
    userId: string,
    dto: AdminUpdateUserDto,
  ): Promise<UserProfileView> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const update: Record<string, unknown> = {};

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      if (email !== user.email) {
        const taken = await this.findByEmail(email);
        if (taken && String(taken._id) !== userId) {
          throw new ConflictException('Email is already in use');
        }
        update.email = email;
      }
    }
    if (dto.phone !== undefined) update.phone = dto.phone;
    if (dto.status !== undefined) update.status = dto.status;
    if (dto.emailVerified !== undefined) {
      update.emailVerified = dto.emailVerified;
    }
    if (dto.kycStatus !== undefined) update.kycStatus = dto.kycStatus;
    if (dto.roles !== undefined) {
      const normalized = normalizeAssignedRoles(dto.roles);
      const removingAdmin =
        !normalized.some(isAdministratorRole) &&
        user.roles.some(isAdministratorRole);
      if (removingAdmin) {
        const adminCount = await this.userModel
          .countDocuments({
            roles: { $in: [Role.Admin, Role.Administrator] },
            _id: { $ne: userId },
          })
          .exec();
        if (adminCount === 0) {
          throw new BadRequestException('Cannot remove the last admin role');
        }
      }
      update.roles = normalized;
    }
    if (dto.password) {
      update.passwordHash = await this.crypto.hashPassword(dto.password);
    }
    for (const field of [
      'firstName',
      'lastName',
      'displayName',
    ] as const) {
      if (dto[field] !== undefined) {
        update[`profile.${field}`] = dto[field];
      }
    }

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: update }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return this.toProfileView(updated);
  }

  async adminDelete(
    userId: string,
    adminId: string,
  ): Promise<{ deleted: boolean; soft: boolean }> {
    if (userId === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.userModel.findById(userId).select('+passwordHash').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.roles.some(isAdministratorRole)) {
      const adminCount = await this.userModel
        .countDocuments({ roles: { $in: [Role.Admin, Role.Administrator] } })
        .exec();
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin account');
      }
    }

    await this.devices.revokeAll(userId);

    if (isGuestSessionAccount(user)) {
      await this.walletModel
        .deleteOne({ userId: new Types.ObjectId(userId) })
        .exec();
      await this.userModel.deleteOne({ _id: userId }).exec();
      return { deleted: true, soft: false };
    }

    const normalizedEmail = user.email?.trim().toLowerCase() ?? '';
    if (
      normalizedEmail.startsWith('deleted+') &&
      normalizedEmail.endsWith('@removed.local') &&
      !user.passwordHash
    ) {
      await this.walletModel
        .deleteOne({ userId: new Types.ObjectId(userId) })
        .exec();
      await this.userModel.deleteOne({ _id: userId }).exec();
      return { deleted: true, soft: false };
    }

    const orderCount = await this.orderModel
      .countDocuments({ userId: new Types.ObjectId(userId) })
      .exec();

    if (orderCount > 0) {
      await this.userModel
        .updateOne(
          { _id: userId },
          {
            $set: {
              status: UserStatus.Banned,
              email: `deleted+${userId}@removed.local`,
            },
          },
        )
        .exec();
      return { deleted: true, soft: true };
    }

    await this.userModel.deleteOne({ _id: userId }).exec();
    return { deleted: true, soft: false };
  }

  async adminBulkDelete(
    userIds: string[],
    adminId: string,
  ): Promise<{
    requested: number;
    hardDeleted: number;
    softDeleted: number;
    failed: number;
    errors: Array<{ id: string; message: string }>;
  }> {
    const uniqueIds = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
    let hardDeleted = 0;
    let softDeleted = 0;
    let failed = 0;
    const errors: Array<{ id: string; message: string }> = [];

    for (const id of uniqueIds) {
      try {
        const result = await this.adminDelete(id, adminId);
        if (result.soft) {
          softDeleted += 1;
        } else {
          hardDeleted += 1;
        }
      } catch (err) {
        failed += 1;
        errors.push({
          id,
          message:
            err instanceof Error ? err.message : 'Delete failed',
        });
      }
    }

    return {
      requested: uniqueIds.length,
      hardDeleted,
      softDeleted,
      failed,
      errors,
    };
  }

  private dayStart(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async enrichAutoDelivery(
    view: UserProfileView,
    user?: UserDocument,
  ): Promise<UserProfileView> {
    const roles = user?.roles ?? view.roles;
    view.autoDelivery = await this.rolePermissions.rolesHavePermission(
      roles,
      'auto_delivery',
    );
    return view;
  }

  private toProfileView(user: UserDocument): UserProfileView {
    return {
      id: String(user._id),
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      status: user.status,
      emailVerified: user.emailVerified,
      kycStatus: user.kycStatus,
      profile: user.profile,
      createdAt: user.createdAt,
      adminNote: user.adminNote,
    };
  }
}
