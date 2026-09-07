import {

  Global,

  Inject,

  Module,

  OnModuleDestroy,

} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

import { CacheService } from './cache.service';

import { REDIS_CLIENT } from './redis.constants';

import { buildRedisConnectionOptions, isRedisOptional } from './redis-options';



let devRedisWarningLogged = false;



@Global()

@Module({

  providers: [

    {

      provide: REDIS_CLIENT,

      inject: [ConfigService],

      useFactory: (config: ConfigService): Redis => {

        const optional = isRedisOptional(config);

        const client = new Redis(buildRedisConnectionOptions(config));



        client.on('error', (err) => {

          if (optional) {

            if (!devRedisWarningLogged) {

              devRedisWarningLogged = true;

              console.warn(

                `[redis] Dev mode: Redis unavailable (${err.message}). Cache, queues, and WS use local fallbacks.`,

              );

            }

            return;

          }

          console.error('[redis]', err.message);

        });



        // Eager connect so bootstrap ping/WS adapter can use Redis when it is up.
        void client.connect().catch(() => undefined);

        return client;

      },

    },

    CacheService,

  ],

  exports: [REDIS_CLIENT, CacheService],

})

export class RedisModule implements OnModuleDestroy {

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}



  async onModuleDestroy(): Promise<void> {

    if (this.client.status === 'end' || this.client.status === 'close') {

      return;

    }

    try {

      await this.client.quit();

    } catch {

      this.client.disconnect();

    }

  }

}


