import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Public } from '../../common/decorators/public.decorator';
import { ChatRoomType } from '../../common/enums';
import { isEphemeralGuestUser } from '../../common/utils/guest-user';
import { isChatStaff } from '../../common/utils/role.utils';
import type { ChatRoomDocument } from '../../database/schemas/chat-room.schema';
import type { AuthenticatedUser, JwtPayload } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';
import { SendMessageDto } from './dto/send-message.dto';
import { TypingDto } from './dto/typing.dto';
import { RoomIdDto } from './dto/room-id.dto';

const userRoom = (userId: string): string => `user:${userId}`;
const chatRoom = (roomId: string): string => `chat:${roomId}`;
const staffRoom = 'staff:chat';

const participantId = (participant: unknown): string => {
  if (
    participant &&
    typeof participant === 'object' &&
    '_id' in participant &&
    (participant as { _id?: unknown })._id
  ) {
    return String((participant as { _id: unknown })._id);
  }
  return String(participant);
};

const isStaff = (user: AuthenticatedUser): boolean => isChatStaff(user.roles);

/**
 * Live-chat gateway (NestJS WebSocket / socket.io).
 * - Authenticates each socket from the JWT in the handshake.
 * - Delivers events to participants via per-user rooms.
 * - Tracks online status + typing in Redis (PresenceService).
 */
@Public()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@WebSocketGateway({ namespace: '/chat', cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chat: ChatService,
    private readonly presence: PresenceService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    let user: AuthenticatedUser;
    try {
      user = await this.authenticate(client);
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
      return;
    }

    client.data.user = user;
    await client.join(userRoom(user.id));
    if (isStaff(user)) {
      await client.join(staffRoom);
    }

    void this.presence
      .connect(user.id, client.id)
      .then((firstConnection) => {
        if (firstConnection) {
          this.server.emit('presence:update', {
            userId: user.id,
            online: true,
          });
        }
      })
      .catch((err) => {
        this.logger.warn(
          `Presence connect skipped for ${user.id}: ${err instanceof Error ? err.message : err}`,
        );
      });

    client.onAny(() => {
      void this.presence.touchAlive(user.id, client.id);
    });

    this.logger.log(`Chat connected: ${user.id}`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (!user) {
      return;
    }
    try {
      const stillOnline = await this.presence.disconnect(user.id, client.id);
      if (!stillOnline) {
        this.server.emit('presence:update', { userId: user.id, online: false });
      }
    } catch (err) {
      this.logger.warn(
        `Presence disconnect skipped for ${user.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  @SubscribeMessage('support:open')
  async openSupport(@ConnectedSocket() client: Socket) {
    const user = this.user(client);
    try {
      const { checkout } = await this.auth.getPanelConfig();
      this.chat.assertRegisteredChatUser(user, checkout.allowGuestChat);
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
    const room = await this.chat.ensureSupportRoom(user);
    await this.joinChatSocketRoom(client, String(room._id));
    return { ok: true, room: this.serializeRoom(room) };
  }

  @SubscribeMessage('room:join')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: RoomIdDto,
  ) {
    const user = this.user(client);
    try {
      const room = await this.chat.getAccessibleRoom(user, dto.roomId);
      await this.joinChatSocketRoom(client, dto.roomId);
      return { ok: true, room: this.serializeRoom(room) };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const user = this.user(client);
    try {
      const config = await this.auth.getPanelConfig();
      const { payload, room } = await this.chat.sendRoomMessage(
        user,
        dto.roomId,
        {
          allowGuestChat: config.checkout.allowGuestChat,
          allowImageUpload: config.chat.allowImageUpload !== false,
          body: dto.body,
          imageUrl: dto.imageUrl,
        },
      );
      this.broadcastToRoom(room, 'message:new', payload);
      await this.presence.setTyping(dto.roomId, user.id, false);
      return { ok: true, id: payload.id, message: payload };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  /** REST send + internal fan-out after a message is persisted. */
  broadcastToRoom(
    room: ChatRoomDocument,
    event: string,
    payload: Record<string, unknown>,
    exceptUserId?: string,
  ): void {
    this.emitToRoom(room, event, payload, exceptUserId);
  }

  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: TypingDto,
  ) {
    const user = this.user(client);
    try {
      const room = await this.chat.getAccessibleRoom(user, dto.roomId);
      const notifyRoom = await this.chat.ensureStaffParticipants(room);
      await this.presence.setTyping(dto.roomId, user.id, dto.isTyping);
      this.emitToRoom(
        notifyRoom,
        'typing',
        { roomId: dto.roomId, userId: user.id, isTyping: dto.isTyping },
        user.id,
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage('message:read')
  async read(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: RoomIdDto,
  ) {
    const user = this.user(client);
    try {
      const room = await this.chat.getAccessibleRoom(user, dto.roomId);
      await this.chat.markRead(user, dto.roomId);
      this.emitToRoom(
        room,
        'message:read',
        { roomId: dto.roomId, userId: user.id },
        user.id,
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage('presence:heartbeat')
  async presenceHeartbeat(@ConnectedSocket() client: Socket) {
    const user = this.user(client);
    await this.presence.touchAlive(user.id, client.id);
    return { ok: true };
  }

  @SubscribeMessage('presence:list')
  async presenceList() {
    const online = await this.presence.listOnline();
    return { ok: true, online };
  }

  // --- Internals ---

  private async joinChatSocketRoom(
    client: Socket,
    roomId: string,
  ): Promise<void> {
    const currentRooms = Array.from(client.rooms).filter((name) =>
      name.startsWith('chat:'),
    );
    for (const name of currentRooms) {
      if (name !== chatRoom(roomId)) {
        await client.leave(name);
      }
    }
    await client.join(chatRoom(roomId));
  }

  private emitToRoom(
    room: ChatRoomDocument,
    event: string,
    payload: Record<string, unknown>,
    exceptUserId?: string,
  ): void {
    const notified = new Set<string>();
    const roomSocketId = chatRoom(String(room._id));

    this.server.to(roomSocketId).emit(event, payload);

    const targets = [...room.participants];
    if (room.createdBy) {
      targets.push(room.createdBy);
    }

    for (const participant of targets) {
      const id = participantId(participant);
      if (!id || id === 'undefined') {
        continue;
      }
      if (exceptUserId && id === exceptUserId) {
        continue;
      }
      if (notified.has(id)) {
        continue;
      }
      notified.add(id);
      this.server.to(userRoom(id)).emit(event, payload);
    }

    if (room.type === ChatRoomType.Support) {
      this.server.to(staffRoom).emit(event, payload);
    }
  }

  private user(client: Socket): AuthenticatedUser {
    return client.data.user as AuthenticatedUser;
  }

  private async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const auth = client.handshake.auth as { token?: string } | undefined;
    const header = client.handshake.headers.authorization;
    const query = client.handshake.query?.token;
    const token =
      auth?.token ??
      (typeof header === 'string'
        ? header.replace(/^Bearer\s+/i, '')
        : undefined) ??
      (typeof query === 'string' ? query : undefined);
    if (!token) {
      throw new Error('Missing token');
    }
    const secret = this.config.get<string>('jwt.accessSecret');
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
    if (!payload?.sub) {
      throw new Error('Invalid token');
    }
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      ...(payload.isGuest || isEphemeralGuestUser({ email: payload.email })
        ? { isGuest: true }
        : {}),
    };
  }

  private serializeRoom(room: ChatRoomDocument): Record<string, unknown> {
    return {
      id: String(room._id),
      type: room.type,
      status: room.status,
      subject: room.subject,
      participants: room.participants.map((p) => String(p)),
      lastMessage: room.lastMessage,
      lastMessageAt: room.lastMessageAt,
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Request failed';
  }
}
