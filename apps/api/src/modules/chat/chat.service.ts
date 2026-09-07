import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoomStatus, ChatRoomType, NotificationAudience, Role } from '../../common/enums';
import { isEphemeralGuestUser } from '../../common/utils/guest-user';
import {
  CHAT_STAFF_ROLES,
  isAdministratorRole,
  isChatStaff,
  userHasRole,
} from '../../common/utils/role.utils';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import {
  ChatMessage,
  ChatMessageDocument,
} from '../../database/schemas/chat-message.schema';
import {
  ChatRoom,
  ChatRoomDocument,
} from '../../database/schemas/chat-room.schema';
import { User, UserDocument, UserProfile } from '../../database/schemas/user.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatNotificationService } from '../notifications/chat-notification.service';
import { UploadsService } from '../../shared/uploads/uploads.service';

const isStaff = (user: AuthenticatedUser): boolean => isChatStaff(user.roles);

const primaryRole = (user: AuthenticatedUser): string => {
  if (user.roles.some(isAdministratorRole)) return Role.Administrator;
  if (userHasRole(user.roles, Role.Editor)) return Role.Editor;
  return user.roles[0] ?? Role.Customer;
};

type SenderNameSource = {
  email: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
  };
};

const resolveSenderDisplayName = (
  source: SenderNameSource,
  role: string,
): string => {
  const profile = source.profile ?? {};
  if (profile.displayName?.trim()) {
    return profile.displayName.trim();
  }
  const fullName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fullName) {
    return fullName;
  }
  if (profile.firstName?.trim()) {
    return profile.firstName.trim();
  }
  const localPart = source.email.split('@')[0]?.trim();
  if (localPart) {
    return localPart;
  }
  return role;
};

const chatMessagePreview = (body?: string, imageUrl?: string): string => {
  const text = body?.trim() ?? '';
  if (text) return text.slice(0, 200);
  if (imageUrl?.trim()) return '[Image]';
  return '';
};

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatRoom.name)
    private readonly roomModel: Model<ChatRoomDocument>,
    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notifications: NotificationsService,
    private readonly chatNotifications: ChatNotificationService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Throws if a guest-session user tries to use chat while guest chat is
   * disabled. Pass `allowGuestChat` from the panel settings (resolved at the
   * controller / gateway call-site so ChatService needs no extra dependency).
   */
  assertRegisteredChatUser(user: AuthenticatedUser, allowGuestChat: boolean): void {
    if (isStaff(user)) return;
    if (allowGuestChat) return;
    if (user.isGuest || isEphemeralGuestUser(user)) {
      throw new ForbiddenException('Login is required to use live chat');
    }
  }

  private assertValidChatImageUrl(imageUrl: string, roomId: string): void {
    const marker = `/uploads/live-chat/${roomId}/`;
    if (!imageUrl.includes(marker)) {
      throw new BadRequestException('Invalid chat image URL');
    }
  }

  // --- Rooms ---

  async ensureSupportRoom(user: AuthenticatedUser): Promise<ChatRoomDocument> {
    const userId = new Types.ObjectId(user.id);
    const openFilter = {
      type: ChatRoomType.Support,
      status: ChatRoomStatus.Open,
      createdBy: userId,
    };

    let room = await this.roomModel
      .findOne(openFilter)
      .sort({ updatedAt: -1 })
      .exec();

    if (!room) {
      const existing = await this.roomModel
        .findOne({
          type: ChatRoomType.Support,
          createdBy: userId,
        })
        .sort({ updatedAt: -1 })
        .exec();

      if (existing) {
        const reopened = await this.roomModel
          .findByIdAndUpdate(
            existing._id,
            { $set: { status: ChatRoomStatus.Open } },
            { new: true },
          )
          .exec();
        room = reopened ?? existing;
      }
    }

    if (!room) {
      try {
        room = await this.roomModel.create({
          type: ChatRoomType.Support,
          status: ChatRoomStatus.Open,
          participants: [userId],
          createdBy: userId,
          subject: 'Support',
        });
      } catch (error) {
        const code = (error as { code?: number }).code;
        if (code === 11000) {
          room = await this.roomModel
            .findOne(openFilter)
            .sort({ updatedAt: -1 })
            .exec();
        } else {
          throw error;
        }
      }
    }

    if (!room) {
      throw new InternalServerErrorException('Failed to open support room');
    }

    await this.roomModel
      .updateMany(
        { ...openFilter, _id: { $ne: room._id } },
        { $set: { status: ChatRoomStatus.Closed } },
      )
      .exec();

    if (!room.participants.some((p) => String(p) === user.id)) {
      const updated = await this.roomModel
        .findByIdAndUpdate(
          room._id,
          { $addToSet: { participants: userId } },
          { new: true },
        )
        .exec();
      if (updated) {
        room = updated;
      }
    }

    return this.ensureStaffParticipants(room);
  }

  /** Support rooms must include staff so live messages reach the admin panel. */
  async ensureStaffParticipants(
    room: ChatRoomDocument,
  ): Promise<ChatRoomDocument> {
    if (room.type !== ChatRoomType.Support) {
      return room;
    }
    const staffUsers = await this.userModel
      .find({ roles: { $in: [...CHAT_STAFF_ROLES] } })
      .select('_id')
      .lean()
      .exec();
    const staffIds = staffUsers.map((u) => u._id);
    if (staffIds.length === 0) {
      return room;
    }
    const updated = await this.roomModel
      .findByIdAndUpdate(
        room._id,
        { $addToSet: { participants: { $each: staffIds } } },
        { new: true },
      )
      .exec();
    return updated ?? room;
  }

  findRoomById(roomId: string): Promise<ChatRoomDocument | null> {
    return this.roomModel.findById(roomId).exec();
  }

  async listRoomsForUser(
    user: AuthenticatedUser,
    pagination: PaginationDto,
    search?: string,
  ): Promise<ChatRoomDocument[]> {
    const filter: Record<string, unknown> = isStaff(user)
      ? {}
      : { participants: new Types.ObjectId(user.id) };
    const term = search?.trim();
    if (term && isStaff(user)) {
      const matchedIds = await this.findCustomerIdsMatching(term);
      if (!matchedIds.length) {
        return [];
      }
      filter.createdBy = { $in: matchedIds };
    }
    const { page, limit } = pagination;
    return this.roomModel
      .find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }

  /** Staff inbox search: match customers by name, email or phone number. */
  private async findCustomerIdsMatching(
    term: string,
  ): Promise<Types.ObjectId[]> {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const or: Record<string, unknown>[] = [
      { email: rx },
      { phone: rx },
      { 'profile.displayName': rx },
      { 'profile.firstName': rx },
      { 'profile.lastName': rx },
    ];
    const digits = term.replace(/\D+/g, '');
    if (digits.length >= 4 && digits !== term) {
      or.push({ phone: new RegExp(digits) });
    }
    const users = await this.userModel
      .find({ $or: or })
      .select('_id')
      .limit(300)
      .lean()
      .exec();
    return users.map((user) => user._id as Types.ObjectId);
  }

  async listRoomsForUserSerialized(
    user: AuthenticatedUser,
    pagination: PaginationDto,
    search?: string,
  ): Promise<Record<string, unknown>[]> {
    const rooms = await this.listRoomsForUser(user, pagination, search);
    const creatorMap = await this.loadCreatorMap(
      rooms
        .filter((room) => room.createdBy)
        .map((room) => String(room.createdBy)),
    );
    const staffView = isStaff(user);
    const unreadRoomIds = staffView
      ? await this.findRoomsWithUnreadCustomerMessages(
          rooms.map((room) => room._id),
        )
      : new Set<string>();
    return rooms.map((room) =>
      this.serializeRoom(
        room,
        room.createdBy
          ? creatorMap.get(String(room.createdBy))
          : undefined,
        staffView ? unreadRoomIds.has(String(room._id)) : false,
      ),
    );
  }

  private async findRoomsWithUnreadCustomerMessages(
    roomIds: Types.ObjectId[],
  ): Promise<Set<string>> {
    if (!roomIds.length) {
      return new Set();
    }
    const staffIds = await this.getStaffUserIds();
    if (!staffIds.length) {
      return new Set();
    }

    const rows = await this.messageModel.aggregate<{
      _id: Types.ObjectId;
    }>([
      {
        $match: {
          roomId: { $in: roomIds },
          senderRole: { $nin: [...CHAT_STAFF_ROLES] },
        },
      },
      {
        $addFields: {
          staffReads: {
            $size: {
              $setIntersection: ['$readBy', staffIds],
            },
          },
        },
      },
      { $match: { staffReads: 0 } },
      { $group: { _id: '$roomId' } },
    ]);

    return new Set(rows.map((row) => String(row._id)));
  }

  private staffUserIdsCache: Types.ObjectId[] | null = null;
  private staffUserIdsCacheAt = 0;

  private async getStaffUserIds(): Promise<Types.ObjectId[]> {
    const now = Date.now();
    if (this.staffUserIdsCache && now - this.staffUserIdsCacheAt < 60_000) {
      return this.staffUserIdsCache;
    }
    const users = await this.userModel
      .find({ roles: { $in: [...CHAT_STAFF_ROLES] } })
      .select('_id')
      .lean()
      .exec();
    this.staffUserIdsCache = users.map((user) => user._id as Types.ObjectId);
    this.staffUserIdsCacheAt = now;
    return this.staffUserIdsCache;
  }

  private async loadCreatorMap(
    creatorIds: string[],
  ): Promise<
    Map<
      string,
      { _id: Types.ObjectId; email: string; phone?: string; profile?: UserProfile }
    >
  > {
    const uniqueIds = [...new Set(creatorIds.filter(Boolean))];
    if (!uniqueIds.length) {
      return new Map();
    }
    const users = await this.userModel
      .find({ _id: { $in: uniqueIds } })
      .select('email phone profile')
      .lean()
      .exec();
    return new Map(
      users.map((user) => [
        String(user._id),
        user as {
          _id: Types.ObjectId;
          email: string;
          phone?: string;
          profile?: UserProfile;
        },
      ]),
    );
  }

  async findCreatorSummary(
    creatorId: string,
  ): Promise<
    | { _id: Types.ObjectId; email: string; phone?: string; profile?: UserProfile }
    | null
  > {
    if (!Types.ObjectId.isValid(creatorId)) {
      return null;
    }
    const user = await this.userModel
      .findById(creatorId)
      .select('email phone profile')
      .lean()
      .exec();
    if (!user) {
      return null;
    }
    return user as {
      _id: Types.ObjectId;
      email: string;
      phone?: string;
      profile?: UserProfile;
    };
  }

  async listRoomIdsForUser(userId: string): Promise<string[]> {
    const rooms = await this.roomModel
      .find({ participants: new Types.ObjectId(userId) })
      .select('_id')
      .lean()
      .exec();
    return rooms.map((r) => String(r._id));
  }

  /**
   * Loads a room the user may access. Staff are auto-joined to support rooms
   * (and assigned if unassigned) so admins can answer any ticket.
   */
  async getAccessibleRoom(
    user: AuthenticatedUser,
    roomId: string,
  ): Promise<ChatRoomDocument> {
    const room = await this.roomModel.findById(roomId).exec();
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    const isParticipant = room.participants.some(
      (p) => String(p) === user.id,
    );
    if (isParticipant) {
      return room;
    }
    if (isStaff(user) && room.type === ChatRoomType.Support) {
      const userId = new Types.ObjectId(user.id);
      const updated = await this.roomModel
        .findByIdAndUpdate(
          roomId,
          {
            $addToSet: { participants: userId },
            ...(room.assignedAdminId
              ? {}
              : { $set: { assignedAdminId: userId } }),
          },
          { new: true },
        )
        .exec();
      if (!updated) {
        throw new NotFoundException('Room not found');
      }
      return updated;
    }
    throw new ForbiddenException('Access denied');
  }

  // --- Messages ---

  async saveMessage(
    room: ChatRoomDocument,
    user: AuthenticatedUser,
    body?: string,
    imageUrl?: string,
  ): Promise<ChatMessageDocument> {
    if (room.status === ChatRoomStatus.Closed) {
      throw new BadRequestException('This conversation is closed');
    }
    const text = body?.trim() ?? '';
    const image = imageUrl?.trim() ?? '';
    if (!text && !image) {
      throw new BadRequestException('Message must include text or an image');
    }
    if (image) {
      this.assertValidChatImageUrl(image, String(room._id));
    }

    const senderId = new Types.ObjectId(user.id);
    const role = primaryRole(user);
    const sender = await this.userModel
      .findById(user.id)
      .select('email profile')
      .lean()
      .exec();
    const senderName = resolveSenderDisplayName(
      sender ?? { email: user.email },
      role,
    );
    const senderFirstName = sender?.profile?.firstName?.trim() || undefined;
    const preview = chatMessagePreview(text, image);
    const message = await this.messageModel.create({
      roomId: room._id,
      senderId,
      senderRole: role,
      senderName,
      senderFirstName,
      body: text,
      imageUrl: image || undefined,
      readBy: [senderId],
    });
    await this.roomModel
      .updateOne(
        { _id: room._id },
        {
          $set: {
            lastMessage: preview,
            lastMessageAt: new Date(),
            lastSenderId: senderId,
          },
        },
      )
      .exec();
    return message;
  }

  /**
   * Shared send pipeline for WebSocket and REST — saves, notifies, returns payload.
   */
  async sendRoomMessage(
    user: AuthenticatedUser,
    roomId: string,
    options: {
      allowGuestChat: boolean;
      allowImageUpload: boolean;
      body?: string;
      imageUrl?: string;
    },
  ): Promise<{
    payload: Record<string, unknown>;
    room: ChatRoomDocument;
  }> {
    this.assertRegisteredChatUser(user, options.allowGuestChat);
    if (options.imageUrl?.trim() && options.allowImageUpload === false) {
      throw new BadRequestException(
        'Picture uploads are disabled for live chat',
      );
    }
    const room = await this.getAccessibleRoom(user, roomId);
    const notifyRoom = await this.ensureStaffParticipants(room);
    const message = await this.saveMessage(
      notifyRoom,
      user,
      options.body,
      options.imageUrl,
    );
    const payload = this.serialize(message);
    const freshRoom =
      (await this.findRoomById(String(notifyRoom._id))) ?? notifyRoom;
    await this.chatNotifications.notifyChatMessage(
      freshRoom,
      user,
      options.body,
      options.imageUrl,
    );
    return { payload, room: freshRoom };
  }

  async getHistory(
    user: AuthenticatedUser,
    roomId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    await this.getAccessibleRoom(user, roomId);
    const filter = { roomId: new Types.ObjectId(roomId) };
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments(filter).exec(),
    ]);
    const ordered = items.reverse();
    const nameMap = await this.loadSenderNameMap(ordered);
    return {
      items: ordered.map((message) => this.serialize(message, nameMap)),
      total,
      page,
      limit,
    };
  }

  private async loadSenderNameMap(
    messages: ChatMessageDocument[],
  ): Promise<Map<string, string>> {
    const missingSenderIds = [
      ...new Set(
        messages
          .filter((message) => !message.senderName)
          .map((message) => String(message.senderId)),
      ),
    ];
    if (!missingSenderIds.length) {
      return new Map();
    }
    const users = await this.userModel
      .find({ _id: { $in: missingSenderIds } })
      .select('email profile roles')
      .lean()
      .exec();
    return new Map(
      users.map((user) => [
        String(user._id),
        resolveSenderDisplayName(
          user,
          user.roles?.some(isAdministratorRole)
            ? Role.Administrator
            : userHasRole(user.roles ?? [], Role.Editor)
              ? Role.Editor
              : Role.Customer,
        ),
      ]),
    );
  }

  async markRead(
    user: AuthenticatedUser,
    roomId: string,
  ): Promise<{ success: boolean }> {
    await this.getAccessibleRoom(user, roomId);
    const userId = new Types.ObjectId(user.id);
    await this.messageModel
      .updateMany(
        { roomId: new Types.ObjectId(roomId), senderId: { $ne: userId }, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } },
      )
      .exec();
    await this.notifications.markChatRoomRead(
      user.id,
      roomId,
      isStaff(user)
        ? NotificationAudience.Staff
        : NotificationAudience.Customer,
    );
    return { success: true };
  }

  async deleteRoom(
    user: AuthenticatedUser,
    roomId: string,
  ): Promise<{ success: boolean }> {
    if (!isStaff(user)) {
      throw new ForbiddenException('Only staff can delete chat rooms');
    }
    if (!Types.ObjectId.isValid(roomId)) {
      throw new NotFoundException('Room not found');
    }
    const room = await this.roomModel.findById(roomId).exec();
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    await this.messageModel.deleteMany({ roomId: room._id }).exec();
    this.uploads.deleteLiveChatRoomFolder(String(room._id));
    await this.roomModel.findByIdAndDelete(roomId).exec();
    return { success: true };
  }

  async updateRoomStatus(
    user: AuthenticatedUser,
    roomId: string,
    status: ChatRoomStatus,
  ): Promise<ChatRoomDocument> {
    if (!isStaff(user)) {
      throw new ForbiddenException('Only staff can update room status');
    }
    const room = await this.roomModel
      .findByIdAndUpdate(roomId, { $set: { status } }, { new: true })
      .exec();
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  async listOnlineSupportStaff(onlineIds: string[]): Promise<
    Array<{
      id: string;
      displayName: string;
      avatarUrl?: string;
      firstName?: string;
    }>
  > {
    if (!onlineIds.length) return [];

    const objectIds = onlineIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (!objectIds.length) return [];

    const staffUsers = await this.userModel
      .find({
        _id: { $in: objectIds },
        roles: { $in: [...CHAT_STAFF_ROLES] },
        isGuest: { $ne: true },
      })
      .select('email profile roles')
      .lean()
      .exec();

    return staffUsers.map((user) => {
      const role = user.roles?.some(isAdministratorRole)
        ? Role.Administrator
        : Role.Editor;
      return {
        id: String(user._id),
        displayName: resolveSenderDisplayName(user, role),
        avatarUrl: user.profile?.avatarUrl ?? undefined,
        firstName: user.profile?.firstName?.trim() || undefined,
      };
    });
  }

  async adminOverview(): Promise<{
    openRooms: number;
    closedRooms: number;
    totalMessages: number;
    namespace: string;
    transport: string;
  }> {
    const [openRooms, closedRooms, totalMessages] = await Promise.all([
      this.roomModel.countDocuments({ status: ChatRoomStatus.Open }).exec(),
      this.roomModel.countDocuments({ status: ChatRoomStatus.Closed }).exec(),
      this.messageModel.countDocuments().exec(),
    ]);
    return {
      openRooms,
      closedRooms,
      totalMessages,
      namespace: '/chat',
      transport: 'socket.io (WebSocket)',
    };
  }

  serializeRoom(
    room: ChatRoomDocument,
    creator?: {
      email: string;
      phone?: string;
      profile?: UserProfile;
      _id?: Types.ObjectId;
    },
    unreadFromCustomer = false,
  ): Record<string, unknown> {
    const customer =
      creator && room.type === ChatRoomType.Support
        ? {
            id: String(room.createdBy),
            email: creator.email,
            displayName: resolveSenderDisplayName(creator, Role.Customer),
            avatarUrl: creator.profile?.avatarUrl,
            phone: creator.phone || undefined,
          }
        : undefined;

    return {
      id: String(room._id),
      type: room.type,
      status: room.status,
      subject: room.subject,
      participants: room.participants.map((p) => String(p)),
      createdBy: room.createdBy ? String(room.createdBy) : undefined,
      customer,
      assignedAdminId: room.assignedAdminId
        ? String(room.assignedAdminId)
        : undefined,
      unreadFromCustomer,
      lastMessage: room.lastMessage,
      lastMessageAt: room.lastMessageAt,
      createdAt: room.createdAt,
    };
  }

  serialize(
    message: ChatMessageDocument,
    senderNameMap?: Map<string, string>,
  ): Record<string, unknown> {
    const senderId = String(message.senderId);
    const senderName =
      message.senderName ??
      senderNameMap?.get(senderId) ??
      message.senderRole;
    return {
      id: String(message._id),
      roomId: String(message.roomId),
      senderId,
      senderRole: message.senderRole,
      senderName,
      senderFirstName: message.senderFirstName ?? undefined,
      body: message.body,
      imageUrl: message.imageUrl,
      createdAt: message.createdAt,
    };
  }
}
