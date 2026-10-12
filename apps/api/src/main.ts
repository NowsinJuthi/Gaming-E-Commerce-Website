import './dns-setup';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import type { Redis } from 'ioredis';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import {
  installOptionalRedisDevSilencer,
  waitForRedisReady,
} from './shared/cache/redis-options';
import { realIpMiddleware } from './security/real-ip.middleware';
import { REDIS_CLIENT } from './shared/cache/redis.constants';
import { RedisIoAdapter } from './shared/ws/redis-io.adapter';
import { resolveUploadsRoot } from './shared/uploads/uploads-root';

installOptionalRedisDevSilencer();

async function bootstrap(): Promise<void> {
  // rawBody preserves the original payload buffer for gateway webhook HMAC checks.
  // bufferLogs holds startup logs until the pino logger is attached.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('app.env') === 'production';

  // Behind Cloudflare/load balancer: trust the proxy chain so req.ip and the
  // rate limiter resolve the real visitor IP from X-Forwarded-For.
  const trustProxyHops =
    config.get<number>('security.cloudflare.trustProxyHops') ?? 1;
  app.set('trust proxy', trustProxyHops);
  app.disable('x-powered-by');

  app.use(realIpMiddleware);
  app.use(
    helmet({
      // CSP is owned by the web app, not this JSON API; enabling it here can
      // break API clients. Other protections (HSTS, no-sniff, etc.) stay on.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: {
        maxAge: 63_072_000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.enableCors({
    origin: config.get<string>('app.corsOrigin') ?? 'http://localhost:3000',
    credentials: true,
  });
  const globalPrefix = config.get<string>('app.globalPrefix') ?? 'api';
  app.setGlobalPrefix(globalPrefix);

  const uploadsDir =
    config.get<string>('app.uploadsDir') ?? resolveUploadsRoot();
  app.use(
    `/${globalPrefix}/uploads`,
    express.static(uploadsDir, {
      maxAge: config.get<string>('app.env') === 'production' ? '7d' : 0,
      fallthrough: true,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Redis-backed Socket.IO adapter for multi-instance fan-out. In dev, fall
  // back to the default in-process adapter when Redis is not running.
  const redis = app.get<Redis>(REDIS_CLIENT);
  const logger = app.get(Logger);
  let wsUsesRedis = false;
  if (isProduction) {
    await waitForRedisReady(redis);
    const redisAdapter = new RedisIoAdapter(app, redis);
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
    wsUsesRedis = true;
  } else {
    try {
      await waitForRedisReady(redis);
      const redisAdapter = new RedisIoAdapter(app, redis);
      await redisAdapter.connectToRedis();
      app.useWebSocketAdapter(redisAdapter);
      wsUsesRedis = true;
    } catch {
      logger.warn(
        'Redis not available — WebSocket using in-process adapter (dev only)',
      );
    }
  }
  if (wsUsesRedis) {
    logger.log('WebSocket adapter: redis');
  }

  // Flush in-flight jobs / DB connections on SIGTERM/SIGINT before exit.
  app.enableShutdownHooks();

  // Interactive API docs are exposed only outside production.
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('UniQbd API')
      .setDescription('Digital-goods marketplace API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  const port = config.get<number>('app.port') ?? 4000;
  const host =
    config.get<string>('app.host') ??
    (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
  await app.listen(port, host);
}

void bootstrap();
