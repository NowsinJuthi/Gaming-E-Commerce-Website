import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums';
import { socketIoCorsOptions } from '../../common/utils/cors-origins';
import { userHasAnyRequiredRole } from '../../common/utils/role.utils';
import { extractAccessTokenFromHandshake } from '../auth/auth-cookies';
import type { JwtPayload } from '../auth/auth.types';
import { MediaIdleDto, MediaWatchDto, VisitorPingDto } from './dto/live-analytics.dto';
import { LiveAnalyticsService } from './live-analytics.service';

const ADMIN_LIVE_ROOM = 'admin:live-analytics';

function canViewLiveAnalytics(roles: string[]): boolean {
  return userHasAnyRequiredRole(roles, [
    Role.Admin,
    Role.Administrator,
    Role.ShopManager,
    Role.Editor,
    Role.Support,
  ]);
}

function visitorLabel(user?: { email?: string; id?: string }): string {
  if (user?.email?.trim()) return user.email.trim();
  if (user?.id) return `User ${user.id.slice(-6)}`;
  return 'Guest';
}

@Public()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@WebSocketGateway({ namespace: '/live-analytics', cors: socketIoCorsOptions() })
export class LiveAnalyticsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(LiveAnalyticsGateway.name);

  constructor(
    private readonly live: LiveAnalyticsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.live.setBroadcast((snapshot) => {
      server.to(ADMIN_LIVE_ROOM).emit('live:snapshot', snapshot);
    });
    this.logger.log('LiveAnalyticsGateway ready — /live-analytics');
  }

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.tryAuth(client);
    if (user) {
      client.data.user = user;
      if (canViewLiveAnalytics(user.roles)) {
        await client.join(ADMIN_LIVE_ROOM);
        const snapshot = await this.live.getSnapshot();
        client.emit('live:snapshot', snapshot);
      }
    }
  }

  handleDisconnect(client: Socket): void {
    void this.live.removeSocket(client.id);
  }

  @SubscribeMessage('visitor:ping')
  async onVisitorPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: VisitorPingDto,
  ): Promise<{ ok: true }> {
    const user = client.data.user as { id?: string; email?: string; roles?: string[] } | undefined;
    await this.live.touchVisitor({
      visitorKey: body.visitorKey,
      socketId: client.id,
      path: body.path,
      pathLabel: body.pathLabel,
      label: visitorLabel(user),
      userId: user?.id ?? null,
    });
    return { ok: true };
  }

  @SubscribeMessage('media:watching')
  async onMediaWatching(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: MediaWatchDto,
  ): Promise<{ ok: true }> {
    const user = client.data.user as { id?: string; email?: string } | undefined;
    await this.live.setMediaWatch({
      visitorKey: body.visitorKey,
      socketId: client.id,
      titleId: body.titleId,
      titleName: body.titleName,
      episodeName: body.episodeName,
      label: visitorLabel(user),
      userId: user?.id ?? null,
    });
    return { ok: true };
  }

  @SubscribeMessage('media:idle')
  async onMediaIdle(@MessageBody() body: MediaIdleDto): Promise<{ ok: true }> {
    await this.live.clearMediaWatch(body.visitorKey);
    return { ok: true };
  }

  private async tryAuth(
    client: Socket,
  ): Promise<{ id: string; email: string; roles: string[] } | null> {
    const token = extractAccessTokenFromHandshake({
      authToken:
        typeof (client.handshake.auth as Record<string, unknown>)?.token === 'string'
          ? ((client.handshake.auth as Record<string, unknown>).token as string)
          : undefined,
      authorization:
        typeof client.handshake.headers?.authorization === 'string'
          ? client.handshake.headers.authorization
          : undefined,
      cookie: client.handshake.headers?.cookie,
    });
    if (!token) return null;
    try {
      const secret = this.config.getOrThrow<string>('jwt.accessSecret');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
      return {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles ?? [],
      };
    } catch {
      return null;
    }
  }
}
