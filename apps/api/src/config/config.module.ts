import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import { configurations } from './configuration';
import { validationSchema } from './validation.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '.env'),
        join(__dirname, '..', '..', '.env'),
        join(__dirname, '..', '..', '..', '..', '.env'),
      ],
      load: configurations,
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
  ],
})
export class ConfigModule {}
