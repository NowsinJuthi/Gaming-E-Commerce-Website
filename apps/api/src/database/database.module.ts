import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('app.env') !== 'production';

        return {
          uri: config.getOrThrow<string>('database.uri'),
          maxPoolSize: config.get<number>('database.maxPoolSize'),
          minPoolSize: config.get<number>('database.minPoolSize'),
          serverSelectionTimeoutMS: config.get<number>(
            'database.serverSelectionTimeoutMS',
          ),
          socketTimeoutMS: config.get<number>('database.socketTimeoutMS'),
          autoIndex: config.get<boolean>('database.autoIndex'),
          retryWrites: true,
          retryReads: true,
          // Prefer IPv4 — avoids slow/failed Atlas discovery on Windows.
          family: 4,
          // Fail faster in dev when Atlas/network is unreachable.
          retryAttempts: isDev ? 3 : 9,
          retryDelay: isDev ? 2000 : 3000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
