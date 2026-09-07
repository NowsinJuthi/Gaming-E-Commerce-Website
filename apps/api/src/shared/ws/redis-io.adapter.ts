import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { waitForRedisReady } from '../cache/redis-options';

/**
 * Socket.IO adapter backed by Redis pub/sub so WebSocket broadcasts reach
 * clients connected to any API instance. Without this, `server.emit` only
 * reaches sockets on the same Node process and horizontal scaling breaks
 * real-time delivery (chat, presence, typing).
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly pubClient: Redis,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    await waitForRedisReady(this.pubClient);
    const subClient = this.pubClient.duplicate();
    // duplicate() may already be connecting — never call connect() twice.
    await waitForRedisReady(subClient);
    this.adapterConstructor = createAdapter(this.pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
