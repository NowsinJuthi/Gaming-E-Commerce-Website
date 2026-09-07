import { registerAs } from '@nestjs/config';

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const databaseConfig = registerAs('database', () => ({
  uri:
    process.env.MONGODB_URI ??
    (process.env.NODE_ENV === 'production'
      ? (() => {
          throw new Error(
            'Missing required environment variable: MONGODB_URI. Set this before starting in production.',
          );
        })()
      : 'mongodb://localhost:27017/uniqbd'),
  maxPoolSize: toInt(process.env.MONGODB_MAX_POOL, 50),
  minPoolSize: toInt(process.env.MONGODB_MIN_POOL, 5),
  serverSelectionTimeoutMS: toInt(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    5_000,
  ),
  socketTimeoutMS: toInt(process.env.MONGODB_SOCKET_TIMEOUT_MS, 45_000),
  // Disable automatic index builds in production; sync indexes via a release
  // step to avoid foreground builds blocking startup under load.
  autoIndex: (process.env.MONGODB_AUTO_INDEX ?? 'true') !== 'false',
}));
