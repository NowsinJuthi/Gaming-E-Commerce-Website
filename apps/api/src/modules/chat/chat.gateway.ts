import { Inject, Logger, UsePipes, ValidationPipe } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Public } from "../../common/decorators/public.decorator";
import { ChatRoomType } from "../../common/enums";
import { socketIoCorsOptions } from "../../common/utils/cors-origins";
import { RedisSlidingWindowLimiter } from "../../common/utils/redis-sliding-window";
import { isEphemeralGuestUser } from "../../common/utils/guest-user";
import { isChatStaff } from "../../common/utils/role.utils";
import { RolePermissionsService } from "../role-permissions/role-permissions.service";
import { isProductionNodeEnv } from "../../config/production-env";
import { REDIS_CLIENT } from "../../shared/cache/redis.constants";
import type { Redis } from "ioredis";
import type { ChatRoomDocument } from "../../database/schemas/chat-room.schema";
import type { AuthenticatedUser } from "../auth/auth.types";
import { extractAccessTokenFromHandshake } from "../auth/auth-cookies";
import { AuthService } from "../auth/auth.service";
import { ChatService } from "./chat.service";
import { PresenceService } from "./presence.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { TypingDto } from "./dto/typing.dto";
import { RoomIdDto } from "./dto/room-id.dto";

const userRoom = (userId: string): string => `user:${userId}`;
const chatRoom = (roomId: string): string => `chat:${roomId}`;
const staffRoom = "staff:chat";

const participantId = (participant: unknown): string => {
  if (
    participant &&
    typeof participant === "object" &&
    "_id" in participant &&
    (participant as { _id?: unknown })._id
  ) {
    return String((participant as { _id: unknown })._id);
  }
  return String(participant);
};

const isStaff = (user: AuthenticatedUser): boolean => isChatStaff(user.roles);

async function guestChatAllowedForUser(
  user: AuthenticatedUser,
  rolePermissions: RolePermissionsService,
): Promise<boolean> {
  if (isStaff(user)) return true;
  if (!user.isGuest && !isEphemeralGuestUser(user)) return true;
  return rolePermissions.rolesHavePermission(
    user.roles,
    "live_chat_without_login",
  );
}

async function pictureUploadAllowedForUser(
  user: AuthenticatedUser,
  rolePermissions: RolePermissionsService,
): Promise<boolean> {
  return rolePermissions.rolesHavePermission(
    user.roles,
    "live_chat_picture_upload",
  );
}

/**
 * Live-chat gateway (NestJS WebSocket / socket.io).
 * - Authenticates each socket from the JWT in the handshake.
 * - Delivers events to participants via per-user rooms.
 * - Tracks online status + typing in Redis (PresenceService).
 */
@Public()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@WebSocketGateway({ namespace: "/chat", cors: socketIoCorsOptions() })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly sendLimiter: RedisSlidingWindowLimiter;
  private readonly typingLimiter: RedisSlidingWindowLimiter;
  private readonly heartbeatLimiter: RedisSlidingWindowLimiter;

  constructor(
    private readonly chat: ChatService,
    private readonly presence: PresenceService,
    private readonly auth: AuthService,
    private readonly rolePermissions: RolePermissionsService,
    @Inject(REDIS_CLIENT) redis: Redis,
  ) {
    const failClosed = isProductionNodeEnv(process.env.NODE_ENV);
    this.sendLimiter = new RedisSlidingWindowLimiter(
      redis,
      30,
      60_000,
      "ws:chat:send",
      failClosed,
    );
    this.typingLimiter = new RedisSlidingWindowLimiter(
      redis,
      20,
      60_000,
      "ws:chat:typing",
      failClosed,
    );
    this.heartbeatLimiter = new RedisSlidingWindowLimiter(
      redis,
      60,
      60_000,
      "ws:chat:heartbeat",
      failClosed,
    );
  }

  afterInit(server: Server): void {
    // Namespace middleware finishes authentication and room membership before
    // Socket.IO tells the browser it is connected. This removes the startup
    // race where room:join/message:send could arrive before client.data.user
    // and the per-user/staff fan-out rooms were ready.
    server.use(async (client: Socket, next) => {
      try {
        const user = await this.authenticate(client);
        client.data.user = user;
        await client.join(userRoom(user.id));
        if (isStaff(user)) {
          await client.join(staffRoom);
        }
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    });
  }

  handleConnection(client: Socket): void {
    const user = client.data.user as AuthenticatedUser;

    void this.presence
      .connect(user.id, client.id)
      .then((firstConnection) => {
        if (firstConnection) {
          this.server.emit("presence:update", {
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
        this.server.emit("presence:update", { userId: user.id, online: false });
      }
    } catch (err) {
      this.logger.warn(
        `Presence disconnect skipped for ${user.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  @SubscribeMessage("support:open")
  async openSupport(@ConnectedSocket() client: Socket) {
    const user = this.user(client);
    try {
      const allowGuestChat = await guestChatAllowedForUser(
        user,
        this.rolePermissions,
      );
      this.chat.assertRegisteredChatUser(user, allowGuestChat);
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
    const room = await this.chat.ensureSupportRoom(user);
    await this.joinChatSocketRoom(client, String(room._id));
    return { ok: true, room: this.serializeRoom(room) };
  }

  @SubscribeMessage("room:join")
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

  @SubscribeMessage("message:send")
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const user = this.user(client);
    if (!(await this.sendLimiter.allow(user.id))) {
      return { ok: false, error: "Too many messages" };
    }
    try {
      const allowGuestChat = await guestChatAllowedForUser(
        user,
        this.rolePermissions,
      );
      const allowImageUpload = await pictureUploadAllowedForUser(
        user,
        this.rolePermissions,
      );
      const { payload, room } = await this.chat.sendRoomMessage(
        user,
        dto.roomId,
        {
          allowGuestChat,
          allowImageUpload,
          body: dto.body,
          imageUrl: dto.imageUrl,
        },
      );
      this.broadcastToRoom(room, "message:new", payload);
      this.scheduleWelcomeAutoReply(room, user, String(payload.id));
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

  scheduleWelcomeAutoReply(
    room: ChatRoomDocument,
    sender: AuthenticatedUser,
    triggerMessageId: string,
  ): void {
    void this.chat
      .createWelcomeAutoReply(room, sender, triggerMessageId)
      .then((payload) => {
        if (payload) {
          this.broadcastToRoom(room, "message:new", payload);
        }
      })
      .catch((error) => {
        this.logger.warn(
          `Welcome auto-reply skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  @SubscribeMessage("typing")
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: TypingDto,
  ) {
    const user = this.user(client);
    if (!(await this.typingLimiter.allow(user.id))) {
      return { ok: false, error: "Too many typing events" };
    }
    try {
      const room = await this.chat.getAccessibleRoom(user, dto.roomId);
      const notifyRoom = await this.chat.ensureStaffParticipants(room);
      await this.presence.setTyping(dto.roomId, user.id, dto.isTyping);
      this.emitToRoom(
        notifyRoom,
        "typing",
        { roomId: dto.roomId, userId: user.id, isTyping: dto.isTyping },
        user.id,
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage("message:read")
  async read(@ConnectedSocket() client: Socket, @MessageBody() dto: RoomIdDto) {
    const user = this.user(client);
    try {
      const room = await this.chat.getAccessibleRoom(user, dto.roomId);
      await this.chat.markRead(user, dto.roomId);
      this.emitToRoom(
        room,
        "message:read",
        { roomId: dto.roomId, userId: user.id },
        user.id,
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage("presence:heartbeat")
  async presenceHeartbeat(@ConnectedSocket() client: Socket) {
    const user = this.user(client);
    if (!(await this.heartbeatLimiter.allow(user.id))) {
      return { ok: false, error: "Too many heartbeats" };
    }
    await this.presence.touchAlive(user.id, client.id);
    return { ok: true };
  }

  @SubscribeMessage("presence:list")
  async presenceList(@ConnectedSocket() client: Socket) {
    const user = this.user(client);
    if (!isStaff(user)) {
      return { ok: false, error: "Forbidden" };
    }
    const online = await this.presence.listOnline();
    return { ok: true, online };
  }

  // --- Internals ---

  private async joinChatSocketRoom(
    client: Socket,
    roomId: string,
  ): Promise<void> {
    const currentRooms = Array.from(client.rooms).filter((name) =>
      name.startsWith("chat:"),
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
      if (!id || id === "undefined") {
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
    const token = extractAccessTokenFromHandshake({
      authToken: auth?.token,
      authorization:
        typeof client.handshake.headers.authorization === "string"
          ? client.handshake.headers.authorization
          : undefined,
      cookie: client.handshake.headers.cookie,
    });
    if (!token) {
      throw new Error("Missing token");
    }
    return this.auth.authenticateAccessToken(token);
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
    return error instanceof Error ? error.message : "Request failed";
  }
}
