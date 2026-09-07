import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtPayload } from '../../modules/auth/auth.types';
import { EventsService } from './events.service';

/**
 * WebSocket gateway for real-time store events (namespace: /events).
 *
 * Authentication is intentionally lenient:
 * - No token      → anonymous connection (suited for storefront cache invalidation).
 * - Valid token   → user context stored in socket.data.user.
 * - Invalid token → connection is rejected immediately to prevent token abuse.
 *
 * All events are broadcast to the entire namespace (no per-room scoping).
 * The gateway never emits — it only wires EventsService to the live server
 * so other services can call EventsService.emit() from anywhere.
 */
@Public()
@WebSocketGateway({ namespace: '/events', cors: true })
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.eventsService.setServer(server);
    this.logger.log('EventsGateway initialised — /events namespace ready');
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);

    if (token) {
      try {
        const secret = this.config.getOrThrow<string>('jwt.accessSecret');
        const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
        client.data.user = {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles,
        };
        this.logger.debug(`Authenticated socket ${client.id} (user: ${payload.sub})`);
      } catch {
        // A token was supplied but is invalid/expired.  Reject rather than
        // allowing a downgrade to anonymous — prevents token-sniffing attacks
        // where a stale token is replayed after logout.
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect(true);
        return;
      }
    } else {
      this.logger.debug(`Anonymous socket connected: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown>;
    const tokenFromAuth = typeof auth?.token === 'string' ? auth.token : undefined;

    const authHeader = client.handshake.headers?.authorization;
    const tokenFromHeader =
      typeof authHeader === 'string'
        ? authHeader.replace(/^Bearer\s+/i, '')
        : undefined;

    const tokenFromQuery =
      typeof client.handshake.query?.token === 'string'
        ? (client.handshake.query.token as string)
        : undefined;

    return tokenFromAuth ?? tokenFromHeader ?? tokenFromQuery ?? null;
  }
}
